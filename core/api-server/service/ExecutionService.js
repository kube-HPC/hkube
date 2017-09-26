'use strict';

const { Producer } = require('producer-consumer.rf');

var Etcd = require('node-etcd');
var etcd = new Etcd("http://localhost:4001");
var options = { recursive: true };
etcd.set("otgvrt", JSON.stringify({ descriptor: "blalba", smescriptor: 123.4 }));



/**
 * get run result
 * returns result (json) for the execution of a spesific pipeline run. if called before result is determined - returns error.
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
 * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
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
 * The run endpoint initiates an algorithm flow with the input recieved and returns the ID of the running pipeline. ID returned can be used as a reference for the flow run to retrieve run status, stop it, etc.
 *
 * storedpipelineRunData RunStoredRequest an object representing all information needed for stored pipeline execution
 * returns pipelineExecutionStatus
 **/
exports.runStoredPOST = function (storedpipelineRunData) {
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
 * wokflow execution status
 * reurns a status for the current pipeline.
 *
 * flow_execution_id UUID Unique identifier representing wokflow execution - is given in response to calling pipeline run method . (optional)
 * returns List
 **/
exports.statusGET = function (flow_execution_id) {
  return new Promise(function (resolve, reject) {

    var runData = {};
    var path = '/services/piplinedriver/' + flow_execution_id;
    etcd.get(path, function (err, val) {
      if (err == null) {
        runData = val.node.value;
      }
      else {
        runData = err;
      }

      var examples = {};
      examples['application/json'] = [{
        "executionID": flow_execution_id,
        "status": runData
      }];
      if (Object.keys(examples).length > 0) {
        resolve(examples[Object.keys(examples)[0]]);
      } else {
        resolve();
      }

    });
  });
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
  //return new Promise(function (resolve, reject) {
    //check status if already stopped?
    const options = {
        job: {
            type: 'stop-job',
            data: { 
              action: 'please stop this job',
              pipeline_execution_id: flow_execution_id,
              reason: reason
            },
            waitingTimeout: 5000
        },
        queue: {
            priority: 1,
            delay: 1000,
            timeout: 5000,
            attempts: 3,
            removeOnComplete: true,
            removeOnFail: false
        },
        setting: {
            queueName: 'sf-queue',
            prefix: 'sf-jobs'
        }
    }
    
    
    const producer = new Producer(options);
    const job = producer.createJob(options);

    return job;

    // job.then(function(resolve, reject){
    //   var examples = {};
    //   examples['application/json'] = "";
    //   if (Object.keys(examples).length > 0) {
    //     resolve(examples[Object.keys(examples)[0]]);
    //   } else {
    //     resolve();
    //   }
    // })


  //});
}

