const mergeWith = require('lodash.mergewith');
const cloneDeep = require('lodash.clonedeep');
const { tracer } = require('@hkube/metrics');
const { parser } = require('@hkube/parsers');
const { uid } = require('@hkube/uid');
const { pipelineTypes, pipelineStatuses } = require('@hkube/consts');
const levels = require('@hkube/logger').Levels;
const storageManager = require('@hkube/storage-manager');
const cachingService = require('./caching');
const producer = require('../producer/jobs-producer');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const pipelineCreator = require('./pipeline-creator');
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
        const storedPipeline = await stateManager.getPipeline({ name: pipeline.name });
        if (!storedPipeline) {
            throw new ResourceNotFoundError('pipeline', pipeline.name);
        }
        const newPipeline = mergeWith(storedPipeline, pipeline, (obj, src, key) => {
            // by default we are not merging the stored flowInput with the payload flowInput
            if (key === 'flowInput' && !mergeFlowInput) {
                return src;
            }
            return undefined;
        });
        return this._run({ pipeline: newPipeline, jobId, rootJobId, options: { parentSpan }, types });
    }

    async _run(payload) {
        let { types } = payload;
        let { flowInputMetadata, ...pipeline } = payload.pipeline;
        const { rootJobId } = payload;
        const { validateNodes, parentSpan } = payload.options || {};
        const userPipeline = cloneDeep(pipeline);

        validator.executions.addPipelineDefaults(pipeline);
        const jobId = this._createJobID();
        const span = tracer.startSpan({ name: 'run pipeline', tags: { jobId, name: pipeline.name }, parent: parentSpan });
        try {
            validator.pipelines.validatePipelineNodes(pipeline);
            pipeline = await pipelineCreator.buildPipelineOfPipelines(pipeline);
            pipeline = await pipelineCreator.buildStreamingFlow(pipeline);
            validator.executions.validatePipeline(pipeline, { validateNodes });
            await validator.experiments.validateExperimentExists(pipeline);
            pipeline = await validator.dataSources.validate(pipeline);
            const algorithms = await validator.algorithms.validateAlgorithmExists(pipeline);
            validator.algorithms.validateAlgorithmImage(algorithms);
            const maxExceeded = await validator.executions.validateConcurrentPipelines(pipeline);
            types = this._addTypesByAlgorithms(algorithms, types);

            if (pipeline.flowInput && !flowInputMetadata) {
                const metadata = parser.replaceFlowInput(pipeline);
                const storageInfo = await storageManager.hkube.put({ jobId, taskId: jobId, data: pipeline.flowInput }, tracer.startSpan.bind(tracer, { name: 'storage-put-input', parent: span.context() }));
                flowInputMetadata = { metadata, storageInfo };
            }
            const lastRunResult = await this._getLastPipeline(pipeline);
            const pipelineObject = { ...pipeline, rootJobId, flowInputMetadata, startTime: Date.now(), lastRunResult, types };
            const statusObject = { timestamp: Date.now(), pipeline: pipeline.name, status: pipelineStatuses.PENDING, level: levels.INFO.name };
            await storageManager.hkubeIndex.put({ jobId }, tracer.startSpan.bind(tracer, { name: 'storage-put-index', parent: span.context() }));
            await stateManager.createJob({ jobId, userPipeline, pipeline: pipelineObject, status: statusObject });
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

    isActiveState(state) {
        return ActiveStates.includes(state);
    }

    isPausedState(state) {
        return PausedState.includes(state);
    }

    async getJobStatus(options) {
        validator.jobs.validateJobID(options);
        const status = await stateManager.getStatus({ jobId: options.jobId });
        if (!status) {
            throw new ResourceNotFoundError('status', options.jobId);
        }
        return status;
    }

    async getPipeline(options) {
        validator.jobs.validateJobID(options);
        const pipeline = await stateManager.getJobPipeline({ jobId: options.jobId });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.jobId);
        }
        return pipeline;
    }

    async getJobResult(options) {
        validator.jobs.validateJobID(options);
        const jobStatus = await stateManager.getStatus({ jobId: options.jobId });
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
        const { name: pipelineName, experimentName, sort, limit } = options;
        const list = await stateManager.searchJobs({
            experimentName,
            pipelineName,
            hasResult: true,
            fields: { jobId: true, result: true },
            sort: { 'result.timestamp': sort },
            limit
        });
        if (list.length === 0) {
            throw new ResourceNotFoundError('pipeline results', options.name);
        }
        const map = list.map(l => ({ jobId: l.jobId, ...l.result }));
        const response = await stateManager.mergeJobStorageResults(map);
        return response;
    }

    async getPipelinesStatus(options) {
        validator.lists.validateResultList(options);
        const { name: pipelineName, experimentName, sort, limit } = options;
        const list = await stateManager.searchJobs({
            experimentName,
            pipelineName,
            fields: { jobId: true, status: true },
            sort: { 'status.timestamp': sort },
            limit
        });
        if (list.length === 0) {
            throw new ResourceNotFoundError('pipeline status', options.name);
        }
        const response = list.map(l => ({ jobId: l.jobId, ...l.status }));
        return response;
    }

    async getRunningPipelines() {
        const list = await stateManager.searchJobs({ hasResult: false, fields: { jobId: true, pipeline: true } });
        return list.map(l => ({ jobId: l.jobId, ...l.pipeline }));
    }

    async stopJob(options) {
        validator.executions.validateStopPipeline(options);
        const { jobId, reason } = options;
        const jobStatus = await stateManager.getStatus({ jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        if (!this.isActiveState(jobStatus.status)) {
            throw new InvalidDataError(`unable to stop pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        const pipeline = await stateManager.getJobPipeline({ jobId });
        const statusObject = { jobId, status: pipelineStatuses.STOPPED, reason, level: levels.INFO.name };
        const resultObject = { jobId, startTime: pipeline.startTime, pipeline: pipeline.name, reason, status: pipelineStatuses.STOPPED };
        await stateManager.updateJobStatus(statusObject);
        await stateManager.updateJobResult(resultObject);
    }

    async pauseJob(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const jobStatus = await stateManager.getStatus({ jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        if (!this.isActiveState(jobStatus.status)) {
            throw new InvalidDataError(`unable to pause pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        const statusObject = { jobId, status: pipelineStatuses.PAUSED, level: levels.INFO.name };
        await stateManager.updateJobStatus(statusObject);
    }

    async resumeJob(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const jobStatus = await stateManager.getStatus({ jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        if (!this.isPausedState(jobStatus.status)) {
            throw new InvalidDataError(`unable to resume pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        const statusObject = { jobId, status: pipelineStatuses.RESUMED, level: levels.INFO.name };
        await stateManager.updateJobStatus(statusObject);
        await producer.createJob({ jobId });
    }

    async getTree(options) {
        validator.jobs.validateJobID(options);
        const tree = await stateManager.getTriggersTree({ jobId: options.jobId });
        if (!tree) {
            throw new ResourceNotFoundError('tree', options.jobId);
        }
        return tree;
    }

    async cleanJob(options) {
        const { jobId } = options;
        const statusObject = { jobId, status: pipelineStatuses.STOPPED, reason: 'clean job' };
        await stateManager.updateJobStatus(statusObject);
        await Promise.all([
            storageManager.hkube.delete({ jobId }),
            storageManager.hkubeResults.delete({ jobId }),
            storageManager.hkubeMetadata.delete({ jobId }),
            stateManager.cleanJob({ jobId }),
            producer.stopJob({ jobId })
        ]);
    }

    _createJobID() {
        return uid({ length: 12 });
    }

    async _getLastPipeline(pipeline) {
        const { experimentName, name: pipelineName } = pipeline;
        const result = await stateManager.searchJobs({
            experimentName,
            pipelineName,
            hasResult: true,
            sort: { 'result.timestamp': 'desc' },
            limit: 1,
            fields: { result: true }
        });
        if (result.length > 0) {
            const { timestamp, status, timeTook } = result[0].result;
            return { timestamp, status, timeTook };
        }
        return null;
    }
}

module.exports = new ExecutionService();
