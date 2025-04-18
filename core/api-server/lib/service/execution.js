const mergeWith = require('lodash.mergewith');
const cloneDeep = require('lodash.clonedeep');
const { tracer } = require('@hkube/metrics');
const { parser } = require('@hkube/parsers');
const { uid } = require('@hkube/uid');
const { pipelineTypes, pipelineStatuses, nodeKind, executeActions } = require('@hkube/consts');
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
const auditing = require('../utils/auditing');

class ExecutionService {
    async runRaw(options, userName) {
        validator.executions.validateRunRawPipeline(options);
        return this._runPipeline({ pipeline: options, parentSpan: options.spanId, types: [pipelineTypes.RAW], userName });
    }

    async runStored(options, userName) {
        validator.executions.validateRunStoredPipeline(options);
        return this._runStored({ pipeline: options, parentSpan: options.spanId, externalId: options.externalId, types: [pipelineTypes.STORED], userName });
    }

    async runCaching(options, userName) {
        validator.executions.validateCaching(options);
        const pipeline = await cachingService.exec({ jobId: options.jobId, nodeName: options.nodeName });
        let { rootJobId } = pipeline;
        if (!rootJobId) {
            rootJobId = pipeline.jobId;
        }
        const { jobId, startTime, lastRunResult, ...restPipeline } = pipeline;
        const debugNode = options.debug ? options.nodeName : null;
        // add debug node if needed
        if (debugNode) {
            let debugOverrides = restPipeline.options.debugOverride || [];
            debugOverrides = debugOverrides.filter(v => restPipeline.nodes.find(n => n.nodeName === v));
            if (!debugOverrides.includes(debugNode)) {
                debugOverrides.push(debugNode);
            }
            restPipeline.options.debugOverride = debugOverrides;
        }
        const types = [...pipeline.types, pipelineTypes.NODE];
        restPipeline.name += `-${options.nodeName}`;
        return this._runPipeline({ pipeline: restPipeline, rootJobId, options: { validateNodes: false }, types, debugNode, userName });
    }

    async rerun(options, userName) {
        validator.executions.validateRerun(options);
        const { jobId } = options;
        const job = await stateManager.getJob({ jobId, fields: { types: 'pipeline.types', userPipeline: true } });
        if (!job) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        const types = [...job.types, pipelineTypes.RERUN];
        return this._runPipeline({ pipeline: job.userPipeline, types, options: { validateNodes: false }, userName });
    }

    async runAlgorithm(options, userName) {
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
        return this._runPipeline({ pipeline, types, userName });
    }

    async _runStored(options) {
        const { pipeline, jobId, rootJobId, parentSpan, types, mergeFlowInput, externalId, userName } = options;
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
        return this._runPipeline({ pipeline: newPipeline, jobId, rootJobId, parentSpan, types, externalId, userName });
    }

    async _runPipeline(payload) {
        const { pipeline, rootJobId, options, parentSpan, types, externalId, userName } = payload;
        const { flowInputMetadata, flowInput, ...restPipeline } = pipeline;
        const { validateNodes } = options || {};
        let extendedPipeline = restPipeline;
        const userPipeline = cloneDeep(extendedPipeline);

        validator.executions.addPipelineDefaults(extendedPipeline);
        const jobId = this._createJobID();
        const span = tracer.startSpan({ name: 'run pipeline', tags: { jobId, name: extendedPipeline.name }, parent: parentSpan });
        try {
            validator.pipelines.validatePipelineNodes(extendedPipeline);
            const maxExceeded = await validator.executions.validateConcurrentPipelines(extendedPipeline);
            extendedPipeline = await pipelineCreator.buildPipelineOfPipelines(extendedPipeline);
            extendedPipeline = await pipelineCreator.updateDebug(extendedPipeline);
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
            const pipelineObject = { ...extendedPipeline, maxExceeded, rootJobId, flowInputMetadata: pipeFlowInputMetadata, startTime: Date.now(), lastRunResult, types: pipeTypes };
            const statusObject = { timestamp: Date.now(), pipeline: extendedPipeline.name, status: pipelineStatuses.PENDING, level: levels.INFO.name };
            const auditObject = auditing.generateAuditEntry(userName, executeActions.RUN, statusObject.timestamp); // Prevent mismatched timestamps
            await storageManager.hkubeIndex.put({ jobId }, tracer.startSpan.bind(tracer, { name: 'storage-put-index', parent: span.context() }));
            await stateManager.createJob({ jobId, userPipeline, externalId, pipeline: pipelineObject, status: statusObject, completion: false, auditTrail: [auditObject] });
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

    async _getGraphByStreamingFlow(payload) {
        let extendedPipeline = payload.pipeline;

        // eslint-disable-next-line no-useless-catch
        try {
            extendedPipeline = await pipelineCreator.buildStreamingFlowGraph(payload);

            const modifiedEdges = extendedPipeline.edges.map((obj) => ({
                from: obj.source,
                to: obj.target,
            }));

            extendedPipeline.edges = modifiedEdges;
            return extendedPipeline;
        }
        catch (error) {
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

    async getAuditTrail(options) {
        validator.jobs.validateJobID(options);
        const auditTrail = await stateManager.geAuditTrail({ jobId: options.jobId });
        if (!auditTrail) {
            throw new ResourceNotFoundError('auditTrail', options.jobId);
        }
        return auditTrail;
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

    async getActivePipelines({ status, raw } = {}) {
        const active = await stateManager.getRunningJobs({ status });

        return raw === 'true' ? active.map(f => (f.jobId)) : active;
    }

    async stopJob(options) {
        // eslint-disable-next-line prefer-const
        let { jobId, reason, userName } = options;
        reason = reason || 'stopped due to request';
        let pipeline;
        let status;
        let result;
        if (jobId) {
            validator.executions.validateStopPipeline(options);
            const job = await stateManager.getJob({ jobId, fields: { status: true, result: true, pipeline: true } });
            ({ status, result, pipeline } = job || {});
            if (!status) {
                throw new ResourceNotFoundError('jobId', jobId);
            }

            if (result) {
                throw new InvalidDataError(`unable to stop pipeline ${pipeline} because it's in ${status} status`);
            }
        }
        else if (options.job) {
            ({ jobId } = options.job || {});
            ({ status, pipeline } = options.job || {});
        }
        const auditObject = auditing.generateAuditEntry(userName, executeActions.STOP);
        const statusObject = { jobId, status: pipelineStatuses.STOPPED, reason, level: levels.INFO.name, auditEntry: auditObject };
        const resultObject = { jobId, startTime: pipeline.startTime, pipeline: pipeline.name, reason, status: pipelineStatuses.STOPPED };
        await stateManager.updateJobStatus(statusObject);
        await stateManager.updateJobResult(resultObject);
    }

    async pauseJob(options) {
        validator.jobs.validateJobID(options);
        const { jobId, userName } = options;
        const job = await stateManager.getJob({ jobId, fields: { status: true, result: true } });
        const { status, result } = job || {};
        if (!status) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        // we only want to pause jobs that have no result
        if (result) {
            throw new InvalidDataError(`unable to pause pipeline ${status.pipeline} because its in ${status.status} status`);
        }
        const auditObject = auditing.generateAuditEntry(userName, executeActions.PAUSE);
        const statusObject = { jobId, status: pipelineStatuses.PAUSED, level: levels.INFO.name, auditEntry: auditObject };
        await stateManager.updateJobStatus(statusObject);
    }

    async resumeJob(options) {
        validator.jobs.validateJobID(options);
        const { jobId, userName } = options;
        const jobStatus = await stateManager.getStatus({ jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        if (!this.isPausedState(jobStatus.status)) {
            throw new InvalidDataError(`unable to resume pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        const auditObject = auditing.generateAuditEntry(userName, executeActions.RESUME);
        const statusObject = { jobId, status: pipelineStatuses.RESUMED, level: levels.INFO.name, auditEntry: auditObject };
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

    async getFlowInputByJobId(jobId) {
        let flowInput;
        const pipeline = await stateManager._db.jobs.fetchPipeline({ jobId });
        if (pipeline?.flowInput) {
            flowInput = pipeline.flowInput;
        }
        else if (!pipeline?.flowInput && pipeline?.flowInputMetadata?.storageInfo) {
            flowInput = await storageManager.storage.get(pipeline.flowInputMetadata.storageInfo);
        }
        return flowInput;
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
