'use strict';

const storedPipelinesMap = require('../service/storedPipelinesMap.js')
const producer = require('lib/producer/jobs-producer');

/**
 * get run result
 * returns result (json) for the execution of a spesific pipeline run. 
 * if called before result is determined - returns error.
 *
 * executionID String executionID to getresults for
 * returns pipelineExecutionResult
 **/
exports.resultsExecutionIDGET = function (executionID) {
  return new Promise(function (resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "result": "{}"
    };
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}

/**
 * run algorithm flow
 * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. 
 * ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
 *
 * pipelineRunData RunRequest an object representing all information needed for pipeline execution
 * returns pipelineExecutionStatus
 **/
exports.runPOST = function (pipelineRunData) {
  return new Promise(function (resolve, reject) {
    var examples = {};
    examples['application/json'] = {
      "executionID": "046b6c7f-0b8a-43b9-b35d-6489e6daee91",
      "status": "status"
    };
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
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

  await producer.createJob(jobdata, pipeline);
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
exports.stopPOST = function (flow_execution_id, reason) {

}