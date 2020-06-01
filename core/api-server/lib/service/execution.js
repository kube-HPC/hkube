const mergeWith = require('lodash.mergewith');
const { tracer } = require('@hkube/metrics');
const { parser } = require('@hkube/parsers');
const { pipelineTypes, pipelineStatuses } = require('@hkube/consts');
const levels = require('@hkube/logger').Levels;
const storageManager = require('@hkube/storage-manager');
const cachingService = require('./caching');
const producer = require('../producer/jobs-producer');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const WebhookTypes = require('../webhook/States').Types;
const regex = require('../../lib/consts/regex');
const { ResourceNotFoundError, InvalidDataError, } = require('../errors');
const { uuid } = require('../utils');
const ActiveStates = [pipelineStatuses.PENDING, pipelineStatuses.CREATING, pipelineStatuses.ACTIVE, pipelineStatuses.RESUMED, pipelineStatuses.PAUSED];
const PausedState = [pipelineStatuses.PAUSED];

class ExecutionService {
    async runRaw(options) {
        validator.validateRunRawPipeline(options);
        return this._run({ pipeline: options, types: [pipelineTypes.RAW] });
    }

    async runStored(options) {
        validator.validateRunStoredPipeline(options);
        return this._runStored({ pipeline: options, types: [pipelineTypes.STORED] });
    }

    async runCaching(options) {
        validator.validateCaching(options);
        const { error, pipeline } = await cachingService.exec({ jobId: options.jobId, nodeName: options.nodeName });
        if (error) {
            throw new InvalidDataError(error.message);
        }
        const { jobId, flowInputOrig, startTime, lastRunResult, types, ...restPipeline } = pipeline;
        const newTypes = [...new Set([...types || [], pipelineTypes.NODE])];
        return this._run({ pipeline: restPipeline, options: { alreadyExecuted: true, validateNodes: false }, types: newTypes });
    }

    async runAlgorithm(options) {
        validator.validateExecAlgorithmRequest(options);
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
        const { pipeline, jobId, rootJobId, parentSpan, types, flowInputNoMerge } = options;
        const storedPipeline = await stateManager.pipelines.get({ name: pipeline.name });
        if (!storedPipeline) {
            throw new ResourceNotFoundError('pipeline', pipeline.name);
        }
        const newPipeline = mergeWith(storedPipeline, pipeline, (obj, src, key) => (key === 'flowInput' && !flowInputNoMerge ? src || obj : undefined));
        return this._run({ pipeline: newPipeline, jobId, rootJobId, options: { parentSpan }, types });
    }

    async _run(payload) {
        let { pipeline, jobId } = payload;
        const { types, rootJobId } = payload;
        const { alreadyExecuted, validateNodes, parentSpan } = payload.options || {};

        validator.addPipelineDefaults(pipeline);
        validator.validatePipeline(pipeline, { validateNodes });

        if (!jobId) {
            jobId = this._createJobID({ name: pipeline.name, experimentName: pipeline.experimentName });
        }

        const span = tracer.startSpan({ name: 'run pipeline', tags: { jobId, name: pipeline.name }, parent: parentSpan });
        try {
            await validator.validateAlgorithmExists(pipeline);
            await validator.validateExperimentExists(pipeline);
            const maxExceeded = await validator.validateConcurrentPipelines(pipeline, jobId);
            if (pipeline.flowInput && !alreadyExecuted) {
                const metadata = parser.replaceFlowInput(pipeline);
                const storageInfo = await storageManager.hkube.put({ jobId, taskId: jobId, data: pipeline.flowInput },
                    tracer.startSpan.bind(tracer, { name: 'storage-put-input', parent: span.context() }));
                pipeline = {
                    ...pipeline,
                    flowInput: { metadata, storageInfo },
                    flowInputOrig: pipeline.flowInput
                };
            }
            const lastRunResult = await this._getLastPipeline(jobId);
            const pipelineObject = { ...pipeline, jobId, rootJobId, startTime: Date.now(), lastRunResult, types };
            await storageManager.hkubeIndex.put({ jobId }, tracer.startSpan.bind(tracer, { name: 'storage-put-index', parent: span.context() }));
            await storageManager.hkubeExecutions.put({ jobId, data: pipelineObject }, tracer.startSpan.bind(tracer, { name: 'storage-put-executions', parent: span.context() }));
            await stateManager.executions.stored.set(pipelineObject);
            await stateManager.executions.running.set(pipelineObject);
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

    isActiveState(state) {
        return ActiveStates.includes(state);
    }

    isPausedState(state) {
        return PausedState.includes(state);
    }

    async getJobStatus(options) {
        validator.validateJobID(options);
        const status = await stateManager.jobs.status.get({ jobId: options.jobId });
        if (!status) {
            throw new ResourceNotFoundError('status', options.jobId);
        }
        return status;
    }

    async getPipeline(options) {
        validator.validateJobID(options);
        const pipeline = await stateManager.executions.stored.get({ jobId: options.jobId });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.jobId);
        }
        return pipeline;
    }

    async getJobResult(options) {
        validator.validateJobID(options);
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
        validator.validateResultList(options);
        const response = await stateManager.getJobResults({ ...options, jobId: `${options.experimentName}:${options.name}` });
        if (response.length === 0) {
            throw new ResourceNotFoundError('pipeline results', options.name);
        }

        return response;
    }

    async getPipelinesStatus(options) {
        validator.validateResultList(options);
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
        validator.validateStopPipeline(options);
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
        validator.validateJobID(options);
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
        validator.validateJobID(options);
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
        validator.validateJobID(options);
        const jobs = await stateManager.jobs.status.getExecutionsTree({ jobId: options.jobId });
        if (jobs == null || jobs.length === 0) {
            throw new ResourceNotFoundError('jobs', options.jobId);
        }
        return jobs;
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
            stateManager.webhooks.delete({ jobId, type: WebhookTypes.PROGRESS }),
            stateManager.webhooks.delete({ jobId, type: WebhookTypes.RESULT }),
            producer.stopJob({ jobId })
        ]);
    }

    _createJobID(options) {
        return [options.experimentName, options.name, uuid()].join(':');
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
