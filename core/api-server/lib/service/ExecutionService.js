const storedPipelinesMap = require('../service/storedPipelinesMap.js')
const producer = require('lib/producer/jobs-producer');
const stateManager = require('lib/state/state-manager');

/**
 * get run result
 * returns result (json) for the execution of a spesific pipeline run. 
 * if called before result is determined - returns error.
 *
 * executionID String executionID to getresults for
 * returns pipelineExecutionResult
 **/
exports.resultsExecutionIDGET = async (executionID) => {
  return await stateManager.getJobResult({ jobId: executionID });
}

/**
 * run algorithm flow
 * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. 
 * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
 *
 * pipelineRunData RunRequest an object representing all information needed for pipeline execution
 * returns pipelineExecutionStatus
 **/
exports.runPOST = async (pipeline) => {
  return await producer.createJob(pipeline);
}

/**
 * run algorithm flow
 * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. 
 * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
 *
 * pipeline RunStoredRequest an object representing all information needed for stored pipeline execution
 * returns pipelineExecutionStatus
 **/
exports.runStoredPOST = async (pipeline) => {
  const requestedPipe = storedPipelinesMap[pipeline.name];
  if (!requestedPipe) {
    throw new Error(`unable to find pipeline ${pipeline.name}`);
  }
  const jobdata = Object.assign({}, requestedPipe, pipeline);
  return await producer.createJob(jobdata);
}

/**
 * wokflow execution status
 * reurns a status for the current pipeline.
 *
 * flow_execution_id UUID Unique identifier representing wokflow execution - is given in response to calling pipeline run method . (optional)
 * returns List
 **/
exports.statusGET = async (flow_execution_id) => {

}

/**
 * stop pipeline execution
 * call to stop the flow execution 
 *
 * flow_execution_id UUID Unique identifier representing wokflow execution - is given in response to calling pipeline run method .
 * reason String reason for stopping. (optional)
 * returns String
 **/
exports.stopPOST = async (flow_execution_id, reason) => {

}