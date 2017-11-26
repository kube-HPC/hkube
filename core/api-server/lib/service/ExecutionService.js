const uuidv4 = require('uuid/v4');
const producer = require('lib/producer/jobs-producer');
const stateManager = require('lib/state/state-manager');
const States = require('lib/state/States');
const { ResourceNotFoundError, ResourceExistsError, InvalidDataError, } = require('lib/errors/errors');

class ExecutionService {

  /**
   * run algorithm flow
   * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. 
   * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
   *
   * pipelineRunData RunRequest an object representing all information needed for pipeline execution
   * returns pipelineExecutionStatus
   **/
  async runRaw(pipeline) {
    if (!pipeline.name) {
      throw new InvalidDataError('pipeline');
    }
    return await this._run(pipeline);
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
    if (!options.name) {
      throw new InvalidDataError('pipeline');
    }
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
    await stateManager.setJobStatus({ jobId: jobId, data: { status: States.PENDING } });
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
    if (!options.executionID) {
      throw new InvalidDataError('execution_id');
    }
    const status = await stateManager.getJobStatus({ jobId: options.executionID });
    if (!status) {
      throw new ResourceNotFoundError('status for', options.executionID);
    }
    return status;
  }

  /**
   * get run result
   * returns result (json) for the execution of a spesific pipeline run. 
   * if called before result is determined - returns error. 
   *
   * executionID String executionID to getresults for
   * returns pipelineExecutionResult
   **/
  async getJobResult(options) {
    if (!options.executionID) {
      throw new InvalidDataError('execution_id');
    }
    const result = await stateManager.getJobResult({ jobId: options.executionID });
    if (!result) {
      throw new ResourceNotFoundError('result for', options.executionID);
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
    if (!options.executionID) {
      throw new InvalidDataError('executionID');
    }
    const job = await stateManager.getJobStatus({ jobId: options.executionID });
    if (!job) {
      throw new ResourceNotFoundError('executionID', options.executionID);
    }
    await producer.stopJob({ jobId: options.executionID });
    await stateManager.stopJob({ jobId: options.executionID, reason: options.reason });
  }

  createJobID(options) {
    return [options.name, uuidv4()].join(':');
  }
}

module.exports = new ExecutionService();