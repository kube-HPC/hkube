const uuidv4 = require('uuid/v4');
const deepExtend = require('deep-extend');
const producer = require('lib/producer/jobs-producer');
const stateManager = require('lib/state/state-manager');
const validator = require('lib/validation/api-validator');
const States = require('lib/state/States');
const { levels } = require('lib/progress/progressLevels');
const { ResourceNotFoundError, InvalidDataError, } = require('lib/errors/errors');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('common/consts/componentNames');

class ExecutionService {

  /**
   * run algorithm flow
   * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. 
   * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
   *
   * pipelineRunData RunRequest an object representing all information needed for pipeline execution
   * returns pipelineExecutionStatus
   **/
  async runRaw(options) {
    validator.validateRunRawPipeline(options);
    return await this._run(options);
  }

  /**
   * run algorithm flow
   * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. 
   * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
   *
   * pipeline RunStoredRequest an object representing all information needed for stored pipeline execution
   * returns pipelineExecutionStatus
   **/
  async runStored(options) {
    log.info(`runStored`, { component: components.JOBS_PRODUCER });
    validator.validateRunStoredPipeline(options);
    const pipe = await stateManager.getPipeline(options);
    if (!pipe) {
      throw new ResourceNotFoundError('pipeline', options.name);
    }
    const pipeline = deepExtend(pipe, options);
    return await this._run(pipeline);
  }

  async _run(pipeline) {
    const jobId = this._createJobID({ name: pipeline.name });
    await stateManager.setExecution({ jobId: jobId, data: pipeline });
    await stateManager.setJobStatus({ jobId: jobId, pipeline: pipeline.name, data: { status: States.PENDING, level: levels.info } });
    await producer.createJob({ jobId: jobId });
    return jobId;
  }

  /**
   * workflow execution status
   * returns a status for the current pipeline.
   *
   * jobId UUID Unique identifier representing workflow execution - is given in response to calling pipeline run method . (optional)
   * returns List
   **/
  async getJobStatus(options) {
    validator.validateExecutionID(options);
    const status = await stateManager.getJobStatus({ jobId: options.jobId });
    if (!status) {
      throw new ResourceNotFoundError('status', options.jobId);
    }
    return status;
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
    validator.validateExecutionID(options);
    const jobStatus = await stateManager.getJobStatus({ jobId: options.jobId });
    if (!jobStatus) {
      throw new ResourceNotFoundError('status', options.jobId);
    }
    if (stateManager.isActiveState(jobStatus.data.status)) {
      throw new InvalidDataError(`unable to get results for pipeline ${jobStatus.pipeline} because its in ${jobStatus.data.status} status`);
    }
    const result = await stateManager.getJobResult({ jobId: options.jobId });
    if (!result) {
      throw new ResourceNotFoundError('results', options.jobId);
    }
    return result;
  }

  /**
   * stop pipeline execution
   * call to stop the flow execution 
   *
   * jobId UUID Unique identifier representing workflow execution - is given in response to calling pipeline run method .
   * reason String reason for stopping. (optional)
   * returns String
   **/
  async stopJob(options) {
    validator.validateStopPipeline(options);
    const jobStatus = await stateManager.getJobStatus({ jobId: options.jobId });
    if (!jobStatus) {
      throw new ResourceNotFoundError('jobId', options.jobId);
    }
    if (!stateManager.isActiveState(jobStatus.data.status)) {
      throw new InvalidDataError(`unable to stop pipeline ${jobStatus.pipeline} because its in ${jobStatus.data.status} status`);
    }
    await stateManager.setJobStatus({ jobId: options.jobId, pipeline: jobStatus.pipeline, data: { status: States.STOPPING, level: levels.info } });
    await stateManager.stopJob({ jobId: options.jobId, reason: options.reason });
  }

  _createJobID(options) {
    return [options.name, uuidv4()].join(':');
  }
}

module.exports = new ExecutionService();