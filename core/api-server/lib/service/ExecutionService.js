const uuidv4 = require('uuid/v4');
const producer = require('lib/producer/jobs-producer');
const stateManager = require('lib/state/state-manager');
const validator = require('lib/validation/api-validator');
const States = require('lib/state/States');
const { levels } = require('lib/progress/progressLevels');
const { ResourceNotFoundError, InvalidDataError, } = require('lib/errors/errors');

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
    validator.validateRunStoredPipeline(options);
    const pipe = await stateManager.getPipeline(options);
    if (!pipe) {
      throw new ResourceNotFoundError('pipeline', options.name);
    }
    const pipeline = Object.assign({}, pipe, options);
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
   * wokflow execution status
   * reurns a status for the current pipeline.
   *
   * flow_execution_id UUID Unique identifier representing wokflow execution - is given in response to calling pipeline run method . (optional)
   * returns List
   **/
  async getJobStatus(options) {
    validator.validateExecutionID(options);
    const status = await stateManager.getJobStatus({ jobId: options.execution_id });
    if (!status) {
      throw new ResourceNotFoundError('status', options.execution_id);
    }
    return status;
  }

  /**
   * get run result
   * returns result (json) for the execution of a spesific pipeline run. 
   * if called before result is determined - returns error. 
   *
   * execution_id String execution_id to getresults for
   * returns pipelineExecutionResult
   **/
  async getJobResult(options) {
    validator.validateExecutionID(options);
    const jobStatus = await stateManager.getJobStatus({ jobId: options.execution_id });
    if (!jobStatus) {
      throw new ResourceNotFoundError('status', options.execution_id);
    }
    if (stateManager.isActiveState(jobStatus.data.status)) {
      throw new InvalidDataError(`unable to get results for pipeline ${jobStatus.pipeline} because its in ${jobStatus.data.status} status`);
    }
    const result = await stateManager.getJobResult({ jobId: options.execution_id });
    if (!result) {
      throw new ResourceNotFoundError('results', options.execution_id);
    }
    return result;
  }

  /**
   * stop pipeline execution
   * call to stop the flow execution 
   *
   * flow_execution_id UUID Unique identifier representing wokflow execution - is given in response to calling pipeline run method .
   * reason String reason for stopping. (optional)
   * returns String
   **/
  async stopJob(options) {
    validator.validateStopPipeline(options);
    const jobStatus = await stateManager.getJobStatus({ jobId: options.execution_id });
    if (!jobStatus) {
      throw new ResourceNotFoundError('execution_id', options.execution_id);
    }
    if (!stateManager.isActiveState(jobStatus.data.status)) {
      throw new InvalidDataError(`unable to stop pipeline ${jobStatus.pipeline} because its in ${jobStatus.data.status} status`);
    }
    await stateManager.stopJob({ jobId: options.execution_id, reason: options.reason });
  }

  _createJobID(options) {
    return [options.name, uuidv4()].join(':');
  }
}

module.exports = new ExecutionService();