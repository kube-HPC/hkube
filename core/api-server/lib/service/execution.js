const merge = require('lodash.merge');
const { tracer } = require('@hkube/metrics');
const { parser } = require('@hkube/parsers');
const levels = require('@hkube/logger').Levels;
const storageManager = require('@hkube/storage-manager');
const cachingService = require('./caching');
const producer = require('../producer/jobs-producer');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const States = require('../state/States');
const WebhookTypes = require('../webhook/States').Types;
const regex = require('../../lib/consts/regex');
const pipelineTypes = require('../../lib/consts/pipeline-types');
const { ResourceNotFoundError, InvalidDataError, } = require('../errors');
const { uuid } = require('../utils');


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
        const { jobId, nodeName } = options;
        const { error, pipeline } = await cachingService.exec({ jobId, nodeName });
        if (error) {
            throw new InvalidDataError(error.message);
        }
        const types = [...new Set([...pipeline.types || [], pipelineTypes.CACHING])];
        const cacheJobId = this._createJobIdForCaching(nodeName);
        return this._run({ pipeline, jobId: cacheJobId, options: { alreadyExecuted: true }, types });
    }

    async _runStored(options) {
        const { pipeline, jobId, types } = options;
        const storedPipeline = await stateManager.getPipeline({ name: pipeline.name });
        if (!storedPipeline) {
            throw new ResourceNotFoundError('pipeline', pipeline.name);
        }
        const newPipeline = merge(storedPipeline, pipeline);
        return this._run({ pipeline: newPipeline, jobId, options: { parentSpan: pipeline.spanId }, types });
    }

    async _run(payload) {
        let { pipeline, jobId } = payload;
        const { types } = payload;
        const { alreadyExecuted, state, parentSpan } = payload.options || {};

        if (!jobId) {
            jobId = this._createJobID({ name: pipeline.name });
        }

        const span = tracer.startSpan({ name: 'run pipeline', tags: { jobId, name: pipeline.name }, parent: parentSpan });
        try {
            validator.addPipelineDefaults(pipeline);
            await validator.validateAlgorithmExists(pipeline);
            await validator.validateConcurrentPipelines(pipeline, jobId);
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
            const startTime = Date.now();
            const status = state || States.PENDING;
            const pipelineObject = { ...pipeline, jobId, startTime, lastRunResult, types };
            await storageManager.hkubeIndex.put({ jobId }, tracer.startSpan.bind(tracer, { name: 'storage-put-index', parent: span.context() }));
            await storageManager.hkubeExecutions.put({ jobId, data: pipelineObject }, tracer.startSpan.bind(tracer, { name: 'storage-put-executions', parent: span.context() }));
            await stateManager.setExecution(pipelineObject);
            await stateManager.setRunningPipeline(pipelineObject);
            await stateManager.setJobStatus({ jobId, pipeline: pipeline.name, status, level: levels.INFO.name });
            await producer.createJob({ jobId, parentSpan: span.context() });
            span.finish();
            return jobId;
        }
        catch (error) {
            span.finish(error);
            throw error;
        }
    }

    async getJobStatus(options) {
        validator.validateJobID(options);
        const status = await stateManager.getJobStatus({ jobId: options.jobId });
        if (!status) {
            throw new ResourceNotFoundError('status', options.jobId);
        }
        return status;
    }

    async getPipeline(options) {
        validator.validateJobID(options);
        const pipeline = await stateManager.getExecution({ jobId: options.jobId });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.jobId);
        }
        return pipeline;
    }

    async getJobResult(options) {
        validator.validateJobID(options);
        const jobStatus = await stateManager.getJobStatus({ jobId: options.jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('status', options.jobId);
        }
        if (stateManager.isActiveState(jobStatus.status)) {
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
        const response = await stateManager.getJobResults({ ...options, jobId: options.name });
        if (response.length === 0) {
            throw new ResourceNotFoundError('pipeline results', options.name);
        }
        return response;
    }

    async getPipelinesStatus(options) {
        validator.validateResultList(options);
        const response = await stateManager.getJobStatuses({ ...options, jobId: options.name });
        if (response.length === 0) {
            throw new ResourceNotFoundError('pipeline status', options.name);
        }
        return response;
    }

    async getRunningPipelines() {
        return stateManager.getRunningPipelines();
    }

    async stopJob(options) {
        validator.validateStopPipeline(options);
        const jobStatus = await stateManager.getJobStatus({ jobId: options.jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', options.jobId);
        }
        if (!stateManager.isActiveState(jobStatus.status)) {
            throw new InvalidDataError(`unable to stop pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        const { jobId } = options;
        const pipeline = await stateManager.getExecution({ jobId });
        await stateManager.updateJobStatus({ jobId, status: States.STOPPED, reason: options.reason, level: levels.INFO.name });
        await stateManager.setJobResults({ jobId, startTime: pipeline.startTime, pipeline: pipeline.name, reason: options.reason, status: States.STOPPED });
    }

    async pauseJob(options) {
        validator.validateJobID(options);
        const { jobId } = options;
        const jobStatus = await stateManager.getJobStatus({ jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        if (!stateManager.isActiveState(jobStatus.status)) {
            throw new InvalidDataError(`unable to pause pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        await stateManager.updateJobStatus({ jobId, status: States.PAUSED, level: levels.INFO.name });
    }

    async resumeJob(options) {
        validator.validateJobID(options);
        const { jobId } = options;
        const jobStatus = await stateManager.getJobStatus({ jobId });
        if (!jobStatus) {
            throw new ResourceNotFoundError('jobId', jobId);
        }
        if (!stateManager.isPausedState(jobStatus.status)) {
            throw new InvalidDataError(`unable to resume pipeline ${jobStatus.pipeline} because its in ${jobStatus.status} status`);
        }
        const pipeline = await stateManager.getExecution({ jobId });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return this._run({ pipeline, jobId, types: pipeline.types, options: { alreadyExecuted: true, state: States.RESUMED } });
    }

    async getTree(options) {
        validator.validateJobID(options);
        const jobs = await stateManager.getExecutionsTree({ jobId: options.jobId });
        if (jobs == null || jobs.length === 0) {
            throw new ResourceNotFoundError('jobs', options.jobId);
        }
        return jobs;
    }

    async cleanJob(options) {
        const { jobId } = options;
        await Promise.all([
            storageManager.hkubeIndex.delete({ jobId }),
            storageManager.hkubeExecutions.delete({ jobId }),
            stateManager.setJobStatus({ jobId: options.jobId, status: States.STOPPED, reason: 'clean job' }),
            stateManager.deleteRunningPipeline({ jobId }),
            stateManager.deleteExecution({ jobId }),
            stateManager.deleteJobResults({ jobId }),
            stateManager.deleteJobStatus({ jobId }),
            stateManager.deleteWebhook({ jobId, type: WebhookTypes.PROGRESS }),
            stateManager.deleteWebhook({ jobId, type: WebhookTypes.RESULT }),
            producer.stopJob({ jobId })
        ]);
    }

    _createJobIdForCaching(nodeName) {
        return ['caching', nodeName, uuid()].join(':');
    }

    _createJobID(options) {
        return [options.name, uuid()].join(':');
    }

    async _getLastPipeline(jobId) {
        const jobIdPrefix = jobId.match(regex.JOB_ID_PREFIX_REGEX);
        if (jobIdPrefix) {
            const result = await stateManager.getJobResultsAsRaw({ jobId: jobIdPrefix[0], limit: 1, sort: 'desc' });
            if (result.length > 0) {
                return (({ timestamp, status, timeTook }) => ({ timestamp, status, timeTook }))(result[0]);
            }
        }
        return null;
    }
}

module.exports = new ExecutionService();
