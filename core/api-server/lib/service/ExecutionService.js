const producer = require('lib/producer/jobs-producer');
const stateManager = require('lib/state/state-manager');
const States = require('lib/state/States');
const ResourceNotFoundError = require('lib/errors/ResourceNotFoundError');
const InvalidNameError = require('lib/errors/InvalidNameError');

/**
 * get run result
 * returns result (json) for the execution of a spesific pipeline run. 
 * if called before result is determined - returns error.
 *
 * executionID String executionID to getresults for
 * returns pipelineExecutionResult
 **/
exports.getJobResult = async (options) => {
  return await stateManager.getJobResult({ jobId: options.executionID });
}

/**
 * run algorithm flow
 * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. 
 * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
 *
 * pipelineRunData RunRequest an object representing all information needed for pipeline execution
 * returns pipelineExecutionStatus
 **/
exports.runRaw = async (options) => {
  if (!options.name) {
    throw new InvalidNameError('pipeline');
  }
  await stateManager.setPipeline({ name: options.name, data: options });
  return await producer.createJob(options);
}

/**
 * run algorithm flow
 * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. 
 * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
 *
 * pipeline RunStoredRequest an object representing all information needed for stored pipeline execution
 * returns pipelineExecutionStatus
 **/
exports.runStored = async (options) => {
  if (!options.name) {
    throw new InvalidNameError('pipeline');
  }
  const requestedPipe = await stateManager.getPipeline({ name: options.name });
  if (!requestedPipe) {
    throw new ResourceNotFoundError('pipeline', options.name);
  }
  const jobId = await producer.createJob({ name: options.name });
  await stateManager.setJobStatus({ jobId: jobId, data: { status: States.PENDING, name: options.name } });
  return jobId;
}

/**
 * wokflow execution status
 * reurns a status for the current pipeline.
 *
 * flow_execution_id UUID Unique identifier representing wokflow execution - is given in response to calling pipeline run method . (optional)
 * returns List
 **/
exports.getJobStatus = async (options) => {
  return await stateManager.getJobStatus({ jobId: options.executionID });
}

/**
 * stop pipeline execution
 * call to stop the flow execution 
 *
 * flow_execution_id UUID Unique identifier representing wokflow execution - is given in response to calling pipeline run method .
 * reason String reason for stopping. (optional)
 * returns String
 **/
exports.stopJob = async (options) => {
  if (!options.executionID) {
    throw new InvalidNameError('executionID');
  }
  const job = await stateManager.getJobStatus({ jobId: options.executionID });
  if (!job) {
    throw new ResourceNotFoundError('executionID', options.executionID);
  }
  await producer.stopJob({ jobId: options.executionID });
  await stateManager.stopJob({ jobId: options.executionID, reason: options.reason });
  await stateManager.setJobResult({ jobId: options.executionID });
}