const uuidv4 = require('uuid/v4');
const merge = require('lodash.merge');
const request = require('requestretry');
const log = require('@hkube/logger').GetLogFromContainer();
const randString = require('crypto-random-string');
const { tracer } = require('@hkube/metrics');
const { parser } = require('@hkube/parsers');
const { main } = require('@hkube/config').load();
const levels = require('@hkube/logger').Levels;
const storageManager = require('@hkube/storage-manager');
const producer = require('../producer/jobs-producer');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const States = require('../state/States');
const component = require('../../lib/consts/componentNames').EXECUTION_SERVICE;
const WebhookTypes = require('../webhook/States').Types;
const regex = require('../../lib/consts/regex');
const { ResourceNotFoundError, InvalidDataError, } = require('../errors');


class ExecutionService {
    async runRaw(options) {
        validator.validateRunRawPipeline(options);
        const pipeline = {
            ...options,
            name: this.createRawName(options)
        };
        return this._run(pipeline);
    }

    async runStored(options) {
        validator.validateRunStoredPipeline(options);
        return this._runStored(options);
    }

    async runCaching({ jobId, nodeName }) {
        validator.validateCaching({ jobId, nodeName });
        const retryStrategy = {
            maxAttempts: 0,
            retryDelay: 5000,
            retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        };
        const { protocol, host, port, prefix } = main.cachingServer;
        const uri = `${protocol}://${host}:${port}/${prefix}?jobId=${jobId}&&nodeName=${nodeName}`;

        const response = await request({
            method: 'GET',
            uri,
            json: true,
            ...retryStrategy
        });
        if (response.statusCode !== 200) {
            throw new Error(`error:${response.body.error.message}`);
        }
        log.debug(`get response with status ${response.statusCode} ${response.statusMessage}`, { component, jobId });
        const cacheJobId = this._createJobIdForCaching(jobId);
        return this._run(response.body, cacheJobId, true);
    }

    async _runStored(options, jobId) {
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        const pipe = merge(pipeline, options);
        return this._run(pipe, jobId);
    }

    async _run(pipeLine, jobID, alreadyExecuted = false) {
        let pipeline = pipeLine;
        let jobId = jobID;
        if (!jobId) {
            jobId = this._createJobID({ name: pipeline.name });
        }
        const span = tracer.startSpan({ name: 'run pipeline', tags: { jobId, name: pipeline.name } });
        try {
            validator.addPipelineDefaults(pipeline);
            await validator.validateAlgorithmName(pipeline);
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
            await storageManager.hkubeIndex.put({ jobId }, tracer.startSpan.bind(tracer, { name: 'storage-put-index', parent: span.context() }));
            await storageManager.hkubeExecutions.put({ jobId, data: pipeline }, tracer.startSpan.bind(tracer, { name: 'storage-put-exeuctions', parent: span.context() }));
            await stateManager.setExecution({ jobId, ...pipeline, startTime: Date.now(), lastRunResult });
            await stateManager.setRunningPipeline({ jobId, ...pipeline, startTime: Date.now(), lastRunResult });
            await stateManager.setJobStatus({ jobId, pipeline: pipeline.name, status: States.PENDING, level: levels.INFO.name });
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

    async getPipelinesResultStored(options) {
        validator.validateResultList(options);
        const response = await stateManager.getJobResults({ ...options, jobId: options.name });
        if (response.length === 0) {
            throw new ResourceNotFoundError('pipeline results', options.name);
        }
        return response;
    }

    async getPipelinesResultRaw(options) {
        validator.validateResultList(options);
        const response = await stateManager.getJobResults({ ...options, jobId: `raw-${options.name}` });
        if (response.length === 0) {
            throw new ResourceNotFoundError('pipeline results', options.name);
        }
        return response;
    }

    async getPipelinesStatusStored(options) {
        validator.validateResultList(options);
        const response = await stateManager.getJobStatuses({ ...options, jobId: options.name });
        if (response.length === 0) {
            throw new ResourceNotFoundError('pipeline status', options.name);
        }
        return response;
    }

    async getPipelinesStatusRaw(options) {
        validator.validateResultList(options);
        const response = await stateManager.getJobStatuses({ ...options, jobId: `raw-${options.name}` });
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
        await stateManager.setJobStatus({ jobId: options.jobId, pipeline: jobStatus.pipeline, status: States.STOPPING, level: levels.INFO.name });
        await stateManager.stopJob({ jobId: options.jobId, reason: options.reason });
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
            stateManager.stopJob({ jobId: options.jobId, reason: 'clean job' }),
            stateManager.deleteRunningPipeline({ jobId }),
            stateManager.deleteExecution({ jobId }),
            stateManager.deleteJobResults({ jobId }),
            stateManager.deleteJobStatus({ jobId }),
            stateManager.deleteWebhook({ jobId, type: WebhookTypes.PROGRESS }),
            stateManager.deleteWebhook({ jobId, type: WebhookTypes.RESULT }),
            producer.stopJob({ jobId })
        ]);
    }

    createRawName(options) {
        return `raw-${options.name}-${randString({ length: 10 })}`;
    }

    _createSubPipelineJobID(options) {
        return [options.jobId, uuidv4()].join('.');
    }

    _createJobIdForCaching(jobId) {
        const originalJobID = jobId.split(':caching')[0];
        return `${originalJobID}:caching:${randString({ length: 4 })}`;
    }

    _createJobID(options) {
        return [`${options.name}:${uuidv4()}`, options.name].join('.');
    }

    async _getLastPipeline(jobId) {
        const jobIdPrefix = jobId.match(regex.JOB_ID_PREFIX_REGEX);
        if (jobIdPrefix) {
            const result = await stateManager.getJobResults({ jobId: jobIdPrefix[0], limit: 1, sort: 'desc' });
            if (result.length > 0) {
                return (({ timestamp, status, timeTook }) => ({ timestamp, status, timeTook }))(result[0]);
            }
        }
        return null;
    }
}

module.exports = new ExecutionService();
