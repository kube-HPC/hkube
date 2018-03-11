const uuidv4 = require('uuid/v4');
const deepExtend = require('deep-extend');
const producer = require('../producer/jobs-producer');
const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const storageFactory = require('../datastore/storage-factory');
const States = require('../state/States');
const levels = require('../progress/progressLevels');
const { ResourceNotFoundError, InvalidDataError, } = require('../errors/errors');
const { tracer } = require('@hkube/metrics');

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
        return this._run(options);
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
        const pipe = await stateManager.getPipeline(options);
        if (!pipe) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        const pipeline = deepExtend(pipe, options);
        return this._run(pipeline);
    }

    /**
     * 
     * 
     * @param {any} pipeline 
     * @returns 
     * 
     * @memberOf ExecutionService
     */
    async _run(pipeline) {
        const jobId = this._createJobID({ name: pipeline.name });
        const span = tracer.startSpan({
            id: jobId,
            name: 'run pipeline',
            tags: {
                jobId,
                name: pipeline.name
            }
        });
        validator.addDefaults(pipeline);
        let spanStorage;
        try {
            spanStorage = tracer.startSpan({
                name: 'storage-create',
                id: jobId,
                tags: {
                    jobId,
                    name: pipeline.name
                }
            });
            await storageFactory.adapter.jobPath({ jobId });
            if (spanStorage) {
                spanStorage.finish();
            }
        }
        catch (error) {
            if (spanStorage) {
                spanStorage.finish(error);
            }
            throw error;
        }
        await stateManager.setExecution({ jobId, data: { ...pipeline, startTime: Date.now() } });
        await stateManager.setJobStatus({ jobId, pipeline: pipeline.name, data: { status: States.PENDING, level: levels.info.name } });
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
        if (stateManager.isActiveState(jobStatus.data.status)) {
            throw new InvalidDataError(`unable to get results for pipeline ${jobStatus.pipeline} because its in ${jobStatus.data.status} status`);
        }
        const response = await stateManager.getJobResult({ jobId: options.jobId });
        if (!response) {
            throw new ResourceNotFoundError('results', options.jobId);
        }
        await storageFactory.setResultsFromStorage(response);
        return response;
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
        if (!stateManager.isActiveState(jobStatus.data.status)) {
            throw new InvalidDataError(`unable to stop pipeline ${jobStatus.pipeline} because its in ${jobStatus.data.status} status`);
        }
        await stateManager.setJobStatus({ jobId: options.jobId, pipeline: jobStatus.pipeline, data: { status: States.STOPPING, level: levels.info.name } });
        await stateManager.stopJob({ jobId: options.jobId, reason: options.reason });
    }

    _createJobID(options) {
        return [options.name, uuidv4()].join(':');
    }
}

module.exports = new ExecutionService();
