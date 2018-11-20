const uuidv4 = require('uuid/v4');
const merge = require('lodash.merge');
const randString = require('crypto-random-string');
const { tracer } = require('@hkube/metrics');
const { parser } = require('@hkube/parsers');
const levels = require('@hkube/logger').Levels;
const storageManager = require('@hkube/storage-manager');
const producer = require('../producer/jobs-producer');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const States = require('../state/States');
const WebhookTypes = require('../webhook/States').Types;
const { ResourceNotFoundError, InvalidDataError, } = require('../errors');


class ExecutionService {
    /**
     * run algorithm flow
     * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline.
     * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
     * pipelineRunData RunRequest an object representing all information needed for pipeline execution
     * returns pipelineExecutionStatus
     *
     * @param {any} options
     * @returns
     *
     * @memberOf ExecutionService
     */
    async runRaw(options) {
        validator.validateRunRawPipeline(options);
        const pipeline = {
            ...options,
            name: this.createRawName(options)
        };
        return this._run(pipeline);
    }

    /**
     * run algorithm flow
     * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline.
     * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
     *
     * pipeline RunStoredRequest an object representing all information needed for stored pipeline execution
     * returns pipelineExecutionStatus
     *
     * @param {any} options
     * @returns
     *
     * @memberOf ExecutionService
     */
    async runStored(options) {
        validator.validateRunStoredPipeline(options);
        return this._runStored(options);
    }

    async _runStored(options, jobId) {
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        const pipe = merge(pipeline, options);
        return this._run(pipe, jobId);
    }

    /**
     *
     * @param {any} pipeline
     * @returns
     *
     * @memberOf ExecutionService
     */
    async _run(pipeLine, jobID) {
        let pipeline = pipeLine;
        let jobId = jobID;
        if (!jobId) {
            jobId = this._createJobID({ name: pipeline.name });
        }
        const span = tracer.startSpan({
            id: jobId,
            name: 'run pipeline',
            tags: {
                jobId,
                name: pipeline.name
            }
        });

        validator.addPipelineDefaults(pipeline);
        await validator.validateAlgorithmName(pipeline);

        if (pipeline.flowInput) {
            const metadata = parser.replaceFlowInput(pipeline);
            const storageInfo = await storageManager.put({ jobId, taskId: jobId, data: pipeline.flowInput });
            pipeline = {
                ...pipeline,
                flowInput: { metadata, storageInfo },
                flowInputOrig: pipeline.flowInput
            };
        }
        await storageManager.putExecution({ jobId, data: pipeline, date: Date.now() });
        await stateManager.setExecution({ jobId, data: { ...pipeline, startTime: Date.now() } });
        await stateManager.setRunningPipeline({ jobId, data: { ...pipeline, startTime: Date.now() } });
        await stateManager.setJobStatus({ jobId, pipeline: pipeline.name, status: States.PENDING, level: levels.INFO.name });
        await producer.createJob({ jobId, parentSpan: span.context() });
        span.finish();
        return jobId;
    }

    /**
     * workflow execution status
     * returns a status for the current pipeline.
     *
     * jobId UUID Unique identifier representing workflow execution - is given in response to calling pipeline run method . (optional)
     * returns List
     *
     * @param {any} options
     * @returns
     *
     * @memberOf ExecutionService
     */
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

    /**
     * get run result
     * returns result (json) for the execution of a specific pipeline run.
     * if called before result is determined - returns error.
     * jobId String jobId to getresults for
     * returns pipelineExecutionResult
     *
     * @param {any} options
     * @returns
     *
     * @memberOf ExecutionService
    */
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

    async getCronResult(options) {
        validator.validateResultList(options);
        const jobId = this._createCronJobID(options);
        const response = await stateManager.getJobResults({ ...options, jobId });
        if (response.length === 0) {
            throw new ResourceNotFoundError('cron results', options.name);
        }
        return response;
    }

    async getCronStatus(options) {
        validator.validateResultList(options);
        const jobId = this._createCronJobID(options);
        const response = await stateManager.getJobStatuses({ ...options, jobId });
        if (response.length === 0) {
            throw new ResourceNotFoundError('cron status', options.name);
        }
        return response;
    }

    async getRunningPipelines() {
        return stateManager.getRunningPipelines();
    }

    /**
     * stop pipeline execution
     * call to stop the flow execution
     *
     * jobId UUID Unique identifier representing workflow execution - is given in response to calling pipeline run method .
     * reason String reason for stopping. (optional)
     * returns String
     * @param {any} options
     *
     * @memberOf ExecutionService
    */
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
        await stateManager.stopJob({ jobId: options.jobId, reason: 'clean job' });
        await Promise.all([
            stateManager.deleteRunningPipeline({ jobId }),
            stateManager.deleteExecution({ jobId }),
            stateManager.deleteJobResults({ jobId }),
            stateManager.deleteJobStatus({ jobId }),
            stateManager.deleteWebhook({ jobId, type: WebhookTypes.PROGRESS }),
            stateManager.deleteWebhook({ jobId, type: WebhookTypes.RESULT }),
            // storageFactory.adapter.delete({ jobId }),
            producer.stopJob({ jobId })
        ]);
    }

    createRawName(options) {
        return `raw-${options.name}-${randString(10)}`;
    }

    _createCronJobID(options, uuid) {
        return ['cron', options.name, uuid].join(':');
    }

    _createSubPipelineJobID(options) {
        return [options.jobId, uuidv4()].join('.');
    }

    _createJobID(options) {
        return [`${options.name}:${uuidv4()}`, options.name].join('.');
    }
}

module.exports = new ExecutionService();
