const mergeWith = require('lodash.mergewith');
const { tracer } = require('@hkube/metrics');
const { parser } = require('@hkube/parsers');
const { uid } = require('@hkube/uid');
const { NodesMap } = require('@hkube/dag');
const { pipelineTypes, pipelineStatuses } = require('@hkube/consts');
const levels = require('@hkube/logger').Levels;
const storageManager = require('@hkube/storage-manager');
const cachingService = require('./caching');
const producer = require('../producer/jobs-producer');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const WebhookTypes = require('../webhook/States').Types;
const regex = require('../consts/regex');
const { ResourceNotFoundError, InvalidDataError, } = require('../errors');
const ActiveStates = [pipelineStatuses.PENDING, pipelineStatuses.CREATING, pipelineStatuses.ACTIVE, pipelineStatuses.RESUMED, pipelineStatuses.PAUSED];
const PausedState = [pipelineStatuses.PAUSED];

class ExecutionService {
    async runRaw(options) {
        validator.executions.validateRunRawPipeline(options);
        return this._run({ pipeline: options, types: [pipelineTypes.RAW] });
    }

    async runStored(options) {
        validator.executions.validateRunStoredPipeline(options);
        return this._runStored({ pipeline: options, types: [pipelineTypes.STORED] });
    }

    async runCaching(options) {
        validator.executions.validateCaching(options);
        const { error, pipeline } = await cachingService.exec({ jobId: options.jobId, nodeName: options.nodeName });
        if (error) {
            throw new InvalidDataError(error.message);
        }
        let { rootJobId } = pipeline;
        if (!rootJobId) {
            rootJobId = pipeline.jobId;
        }
        const { jobId, startTime, lastRunResult, types, ...restPipeline } = pipeline;
        const newTypes = this._mergeTypes(types, [pipelineTypes.NODE]);
        return this._run({ pipeline: restPipeline, rootJobId, options: { validateNodes: false }, types: newTypes });
    }

    async runAlgorithm(options) {
        validator.executions.validateExecAlgorithmRequest(options);
        const { name, input } = options;
        const pipeline = {
            name,
            nodes: [{
                nodeName: name,
                algorithmName: name,
                input
            }]
        };
        return this._run({ pipeline, types: [pipelineTypes.ALGORITHM] });
    }

    async _runStored(options) {
        const { pipeline, jobId, rootJobId, parentSpan, types, mergeFlowInput } = options;
        const storedPipeline = await stateManager.pipelines.get({ name: pipeline.name });
        if (!storedPipeline) {
            throw new ResourceNotFoundError('pipeline', pipeline.name);
        }
        const newPipeline = mergeWith(storedPipeline, pipeline, (obj, src, key) => (key === 'flowInput' && mergeFlowInput ? undefined : src || obj));
        return this._run({ pipeline: newPipeline, jobId, rootJobId, options: { parentSpan }, types });
    }

    async _run(payload) {
        let { jobId, types } = payload;
        let { flowInputMetadata, ...pipeline } = payload.pipeline;
        const { rootJobId } = payload;
        const { validateNodes, parentSpan } = payload.options || {};

        validator.executions.addPipelineDefaults(pipeline);
        validator.executions.validatePipeline(pipeline, { validateNodes });

        if (!jobId) {
            jobId = this._createJobID({ name: pipeline.name, experimentName: pipeline.experimentName });
        }

        const span = tracer.startSpan({ name: 'run pipeline', tags: { jobId, name: pipeline.name }, parent: parentSpan });
        try {
            pipeline = await this._buildPipelineOfPipelines(pipeline);
            await validator.experiments.validateExperimentExists(pipeline);
            const algorithms = await validator.algorithms.validateAlgorithmExists(pipeline);
            const maxExceeded = await validator.executions.validateConcurrentPipelines(pipeline);
            types = this._addTypesByAlgorithms(algorithms, types);

            if (pipeline.flowInput && !flowInputMetadata) {
                const metadata = parser.replaceFlowInput(pipeline);
                const storageInfo = await storageManager.hkube.put({ jobId, taskId: jobId, data: pipeline.flowInput }, tracer.startSpan.bind(tracer, { name: 'storage-put-input', parent: span.context() }));
                flowInputMetadata = { metadata, storageInfo };
            }
            const lastRunResult = await this._getLastPipeline(jobId);
            const pipelineObject = { ...pipeline, jobId, rootJobId, flowInputMetadata, startTime: Date.now(), lastRunResult, types };
            await storageManager.hkubeIndex.put({ jobId }, tracer.startSpan.bind(tracer, { name: 'storage-put-index', parent: span.context() }));
            await storageManager.hkubeExecutions.put({ jobId, data: pipelineObject }, tracer.startSpan.bind(tracer, { name: 'storage-put-executions', parent: span.context() }));
            await stateManager.executions.stored.set(pipelineObject);
            await stateManager.executions.running.set(pipelineObject);
            await stateManager.jobs.active.set({ jobId, pipeline: pipeline.name, types, experiment: pipeline.experimentName });
            await stateManager.jobs.status.set({ jobId, pipeline: pipeline.name, status: pipelineStatuses.PENDING, level: levels.INFO.name });
            await producer.createJob({ jobId, maxExceeded, parentSpan: span.context() });
            span.finish();
            return jobId;
        }
        catch (error) {
            span.finish(error);
            throw error;
        }
    }

    _addTypesByAlgorithms(algorithms, types) {
        const newTypes = new Set();
        algorithms.forEach((v) => {
            if (v.options.debug) {
                newTypes.add(pipelineTypes.DEBUG);
            }
            if (v.options.devMode) {
                newTypes.add(pipelineTypes.DEV_MODE);
            }
        });
        return this._mergeTypes(types, [...newTypes]);
    }

    _mergeTypes(...types) {
        let newTypes = [];
        types.forEach(array => {
            newTypes = [...newTypes, ...array || []];
        });
        return [...new Set([...newTypes])];
    }

    async _buildPipelineOfPipelines(pipeline) {
        let newPipeline = pipeline;
        const pipelinesNodes = pipeline.nodes.filter(p => p.pipelineName);
        if (pipelinesNodes.length > 0) {
            const pipelines = await stateManager.pipelines.list();
            const flowInput = pipeline.flowInput || {};

            pipelinesNodes.forEach(n => {
                const storedPipeline = pipelines.find(p => p.name === n.pipelineName);
                if (!storedPipeline) {
                    throw new ResourceNotFoundError('pipeline', n.pipelineName);
                }
                mergeWith(flowInput, storedPipeline.flowInput);
            });

            const nodes = [];
            const edges = [];

            pipeline.nodes.forEach(node => {
                if (node.input.length > 0) {
                    node.input.forEach((i) => {
                        const results = parser.extractNodesFromInput(i);
                        if (results.length > 0) {
                            results.forEach(r => {
                                const nd = pipeline.nodes.find(n => n.nodeName === r.nodeName);
                                const source = nd;
                                const target = node;

                                const sourceNodes = this._mapNodes(source, pipelines);
                                const targetNodes = this._mapNodes(target, pipelines);

                                nodes.push(...sourceNodes, ...targetNodes);

                                const sourceGraph = new NodesMap({ nodes: sourceNodes });
                                const targetGraph = new NodesMap({ nodes: targetNodes });

                                const sinks = sourceGraph._graph.sinks();
                                const sources = targetGraph._graph.sources();

                                sinks.forEach(s => {
                                    sources.forEach(t => {
                                        edges.push({ source: s, target: t });
                                    });
                                });
                            });
                        }
                        else {
                            const mapNodes = this._mapNodes(node, pipelines);
                            nodes.push(...mapNodes);
                        }
                    });
                }
                else {
                    const mapNodes = this._mapNodes(node, pipelines);
                    nodes.push(...mapNodes);
                }
            });
            const nodesList = nodes.filter((n, i, s) => i === s.findIndex((t) => t.nodeName === n.nodeName));
            newPipeline = {
                ...pipeline,
                flowInput,
                nodes: nodesList,
                edges
            };
        }
        return newPipeline;
    }

    _mapNodes(node, pipelines) {
        if (node.pipelineName) {
            const pipeline = pipelines.find(p => p.name === node.pipelineName);
            const nodes = this._mapInput(pipeline.nodes, node.nodeName);
            return nodes;
        }
        return [node];
    }

    _mapInput(nodes, nodeName) {
        return nodes.map(n => {
            const input = parser.replaceNodeInput(n.input, nodeName);
            const node = {
                ...n,
                nodeName: `${nodeName}-${n.nodeName}`,
                input
            };
            return node;
        });
    }

    isActiveState(state) {
        return ActiveStates.includes(state);
    }

    isPausedState(state) {
        return PausedState.includes(state);
    }

    async getJobStatus(options) {
        validator.jobs.validateJobID(options);
        const status = await stateManager.jobs.status.get({ jobId: options.jobId });
        if (!status) {
            throw new ResourceNotFoundError('status', options.jobId);
        }
        return status;
    }

    async getPipeline(options) {
        validator.jobs.validateJobID(options);
        const pipeline = await stateManager.executions.stored.get({ jobId: options.jobId });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.jobId);
        }
        return pipeline;
    }

    async getJobResult(options) {
        validator.jobs.validateJobID(options);
        const jobStatus = await stateManager.jobs.status.get({ jobId: options.jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('status', options.jobId);
        }
        if (this.isActiveState(jobStatus.status)) {
            throw new InvalidDataError(`unable to get results for pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        const response = await stateManager.getJobResult({ jobId: options.jobId });
        if (!response) {
            throw new ResourceNotFoundError('results', options.jobId);
        }
        return response;
    }

    async getPipelinesResult(options) {
        validator.lists.validateResultList(options);
        const response = await stateManager.getJobResults({ ...options, jobId: `${options.experimentName}:${options.name}` });
        if (response.length === 0) {
            throw new ResourceNotFoundError('pipeline results', options.name);
        }

        return response;
    }

    async getPipelinesStatus(options) {
        validator.lists.validateResultList(options);
        const response = await stateManager.jobs.status.list({ ...options, jobId: `${options.experimentName}:${options.name}` });
        if (response.length === 0) {
            throw new ResourceNotFoundError('pipeline status', options.name);
        }
        return response;
    }

    async getRunningPipelines() {
        return stateManager.executions.running.list();
    }

    async stopJob(options) {
        validator.executions.validateStopPipeline(options);
        const jobStatus = await stateManager.jobs.status.get({ jobId: options.jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', options.jobId);
        }
        if (!this.isActiveState(jobStatus.status)) {
            throw new InvalidDataError(`unable to stop pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        const { jobId } = options;
        const pipeline = await stateManager.executions.stored.get({ jobId });
        await stateManager.jobs.status.update({ jobId, status: pipelineStatuses.STOPPED, reason: options.reason, level: levels.INFO.name });
        await stateManager.jobs.results.set({ jobId, startTime: pipeline.startTime, pipeline: pipeline.name, reason: options.reason, status: pipelineStatuses.STOPPED });
    }

    async pauseJob(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const jobStatus = await stateManager.jobs.status.get({ jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        if (!this.isActiveState(jobStatus.status)) {
            throw new InvalidDataError(`unable to pause pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        await stateManager.jobs.status.update({ jobId, status: pipelineStatuses.PAUSED, level: levels.INFO.name });
    }

    async resumeJob(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const jobStatus = await stateManager.jobs.status.get({ jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        if (!this.isPausedState(jobStatus.status)) {
            throw new InvalidDataError(`unable to resume pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        await stateManager.jobs.status.update({ jobId, status: pipelineStatuses.RESUMED, level: levels.INFO.name });
        await producer.createJob({ jobId });
    }

    async getTree(options) {
        validator.jobs.validateJobID(options);
        const tree = await stateManager.triggers.tree.get({ jobId: options.jobId });
        if (!tree) {
            throw new ResourceNotFoundError('tree', options.jobId);
        }
        return tree;
    }

    async cleanJob(options) {
        const { jobId } = options;
        await stateManager.jobs.status.set({ jobId, status: pipelineStatuses.STOPPED, reason: 'clean job' });
        await Promise.all([
            storageManager.hkubeIndex.delete({ jobId }),
            storageManager.hkubeExecutions.delete({ jobId }),
            storageManager.hkube.delete({ jobId }),
            storageManager.hkubeResults.delete({ jobId }),
            storageManager.hkubeMetadata.delete({ jobId }),
            stateManager.executions.running.delete({ jobId }),
            stateManager.executions.stored.delete({ jobId }),
            stateManager.jobs.results.delete({ jobId }),
            stateManager.jobs.status.delete({ jobId }),
            stateManager.jobs.tasks.delete({ jobId }),
            stateManager.webhooks.delete({ jobId, type: WebhookTypes.PROGRESS }),
            stateManager.webhooks.delete({ jobId, type: WebhookTypes.RESULT }),
            producer.stopJob({ jobId })
        ]);
    }

    _createJobID(options) {
        return [options.experimentName, options.name, uid({ length: 8 })].join(':');
    }

    async _getLastPipeline(jobId) {
        const jobIdPrefix = jobId.match(regex.JOB_ID_PREFIX_REGEX);
        if (jobIdPrefix) {
            const result = await stateManager.jobs.results.list({ jobId: jobIdPrefix[0], limit: 1, sort: 'desc' });
            if (result.length > 0) {
                return (({ timestamp, status, timeTook }) => ({ timestamp, status, timeTook }))(result[0]);
            }
        }
        return null;
    }
}

module.exports = new ExecutionService();
