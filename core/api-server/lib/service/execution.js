const mergeWith = require('lodash.mergewith');
const cloneDeep = require('lodash.clonedeep');
const { tracer } = require('@hkube/metrics');
const { parser } = require('@hkube/parsers');
const { uid } = require('@hkube/uid');
const { pipelineTypes, pipelineStatuses, nodeKind } = require('@hkube/consts');
const levels = require('@hkube/logger').Levels;
const storageManager = require('@hkube/storage-manager');
const cachingService = require('./caching');
const producer = require('../producer/jobs-producer');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const pipelineCreator = require('./pipeline-creator');
const gatewayService = require('./gateway');
const debugService = require('./debug');
const { ResourceNotFoundError, InvalidDataError, } = require('../errors');
const PausedState = [pipelineStatuses.PAUSED];

class ExecutionService {
    async runRaw(options) {
        validator.executions.validateRunRawPipeline(options);
        return this._runPipeline({ pipeline: options, types: [pipelineTypes.RAW] });
    }

    async runStored(options) {
        validator.executions.validateRunStoredPipeline(options);
        return this._runStored({ pipeline: options, types: [pipelineTypes.STORED] });
    }

    async runCaching(options) {
        validator.executions.validateCaching(options);
        const pipeline = await cachingService.exec({ jobId: options.jobId, nodeName: options.nodeName });
        let { rootJobId } = pipeline;
        if (!rootJobId) {
            rootJobId = pipeline.jobId;
        }
        const { jobId, startTime, lastRunResult, ...restPipeline } = pipeline;
        const debugNode = options.debug ? options.nodeName : null;
        const types = [...pipeline.types, pipelineTypes.NODE];
        return this._runPipeline({ pipeline: restPipeline, rootJobId, options: { validateNodes: false }, types, debugNode });
    }

    async rerun(options) {
        validator.executions.validateRerun(options);
        const { jobId } = options;
        const job = await stateManager.getJob({ jobId, fields: { types: 'pipeline.types', userPipeline: true } });
        if (!job) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        const types = [...job.types, pipelineTypes.RERUN];
        return this._runPipeline({ pipeline: job.userPipeline, types, options: { validateNodes: false } });
    }

    async runAlgorithm(options) {
        validator.executions.validateExecAlgorithmRequest(options);
        const { name, input, debug } = options;
        const pipeline = {
            name,
            nodes: [{
                nodeName: name,
                algorithmName: name,
                input,
                kind: debug ? nodeKind.Debug : nodeKind.Algorithm
            }]
        };
        const types = [pipelineTypes.ALGORITHM];
        return this._runPipeline({ pipeline, types });
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
        return this._runPipeline({ pipeline: newPipeline, jobId, rootJobId, options: { parentSpan }, types });
    }

    async _runPipeline(payload) {
        const { pipeline, rootJobId, options, types, debugNode } = payload;
        const { flowInputMetadata, flowInput, ...restPipeline } = pipeline;
        const { parentSpan, validateNodes } = options || {};
        let extendedPipeline = restPipeline;
        const userPipeline = cloneDeep(extendedPipeline);

        validator.executions.addPipelineDefaults(extendedPipeline);
        const jobId = this._createJobID();
        const span = tracer.startSpan({ name: 'run pipeline', tags: { jobId, name: extendedPipeline.name }, parent: parentSpan });
        try {
            validator.pipelines.validatePipelineNodes(extendedPipeline);
            const concurrency = await validator.executions.validateConcurrentPipelines(extendedPipeline, types);
            extendedPipeline = await pipelineCreator.buildPipelineOfPipelines(extendedPipeline);
            extendedPipeline = await pipelineCreator.updateDebug(extendedPipeline, debugNode);
            extendedPipeline = await pipelineCreator.updateOutput(extendedPipeline, jobId);
            extendedPipeline = await pipelineCreator.updateOptimize(extendedPipeline, jobId);
            const algorithms = await validator.algorithms.validateAlgorithmExists(extendedPipeline);
            extendedPipeline = await pipelineCreator.buildStreamingFlow(extendedPipeline, jobId, algorithms);

            const shouldValidateNodes = validateNodes ?? true;
            validator.executions.validatePipeline({ ...extendedPipeline, flowInput: extendedPipeline.flowInput || flowInput }, { validateNodes: shouldValidateNodes });
            await validator.experiments.validateExperimentExists(extendedPipeline);
            extendedPipeline = await validator.dataSources.validate(extendedPipeline);

            const pipeTypes = this._addTypesByAlgorithms(algorithms, types);
            let pipeFlowInputMetadata = flowInputMetadata;

            if (flowInput && Object.keys(flowInput).length && !pipeFlowInputMetadata) {
                const metadata = parser.replaceFlowInput({ ...extendedPipeline, flowInput });
                const storageInfo = await storageManager.hkube.put({ jobId, taskId: jobId, data: flowInput }, tracer.startSpan.bind(tracer, { name: 'storage-put-input', parent: span.context() }));
                pipeFlowInputMetadata = { metadata, storageInfo };
            }
            userPipeline.flowInput = null;
            userPipeline.flowInputMetadata = pipeFlowInputMetadata;
            extendedPipeline.flowInput = null;
            extendedPipeline.flowInputMetadata = pipeFlowInputMetadata;
            const lastRunResult = await this._getLastPipeline(extendedPipeline);
            const pipelineObject = { ...extendedPipeline, concurrency, rootJobId, flowInputMetadata: pipeFlowInputMetadata, startTime: Date.now(), lastRunResult, types: pipeTypes };
            const statusObject = { timestamp: Date.now(), pipeline: extendedPipeline.name, status: pipelineStatuses.PENDING, level: levels.INFO.name };
            const graph = pipelineCreator.createGraph({ jobId, pipeline: extendedPipeline, shouldValidateNodes });
            await storageManager.hkubeIndex.put({ jobId }, tracer.startSpan.bind(tracer, { name: 'storage-put-index', parent: span.context() }));
            await stateManager.createJob({ jobId, graph, userPipeline, pipeline: pipelineObject, status: statusObject });
            await producer.createJob({ jobId, parentSpan: span.context() });
            span.finish();
            return { jobId, gateways: extendedPipeline.streaming?.gateways };
        }
        catch (error) {
            gatewayService.deleteGateways({ pipeline: extendedPipeline });
            debugService.updateLastUsed({ pipeline: extendedPipeline });
            span.finish(error);
            throw error;
        }
    }

    async search(options) {
        validator.executions.validateSearch(options);
        return stateManager.searchJobsAPI(options);
    }

    _addTypesByAlgorithms(algorithms, types) {
        const newTypes = new Set();
        algorithms.forEach((v) => {
            if (v.kind === nodeKind.Debug) {
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
        const { jobId } = options;
        const pipeline = await stateManager.getJobPipeline({ jobId });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', jobId);
        }
        if (!pipeline.flowInput && pipeline.flowInputMetadata?.storageInfo) {
            pipeline.flowInput = await storageManager.storage.get(pipeline.flowInputMetadata?.storageInfo);
        }
        return pipeline;
    }

    async getJobResult(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const job = await stateManager.getJob({ jobId, fields: { status: true, result: true } });
        const { status, result } = job || {};
        if (!status) {
            throw new ResourceNotFoundError('status', jobId);
        }
        // we only want to get job result for job that has result
        if (!result) {
            throw new InvalidDataError(`unable to get results for pipeline ${status.pipeline} because its in ${status.status} status`);
        }
        const response = await stateManager.getResultFromStorage({ jobId, ...result });
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
        const job = await stateManager.getJob({ jobId, fields: { status: true, result: true } });
        const { status, result } = job || {};
        if (!status) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        // we only want to stop jobs that have no result
        if (result) {
            throw new InvalidDataError(`unable to stop pipeline ${status.pipeline} because its in ${status.status} status`);
        }

        await stateManager.updateJobStatus({ jobId, status: pipelineStatuses.STOPPED, reason, level: levels.INFO.name });
        await stateManager.updateJobResult({ jobId, reason, status: pipelineStatuses.STOPPED });
    }

    async pauseJob(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const job = await stateManager.getJob({ jobId, fields: { status: true, result: true } });
        const { status, result } = job || {};
        if (!status) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        // we only want to pause jobs that have no result
        if (result) {
            throw new InvalidDataError(`unable to pause pipeline ${status.pipeline} because its in ${status.status} status`);
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
