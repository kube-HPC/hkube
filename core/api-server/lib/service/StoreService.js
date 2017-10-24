'use strict';


/**
 * get all pipelines
 * returns all pipelines that are currently in the store (names list)
 *
 * returns piplineNames
 **/
exports.storeGET = function() {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "piplineNamesList" : [ "piplineNamesList", "piplineNamesList" ]
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * add a pipeline
 * adds the given pipeline to the store.
 *
 * pipeline Pipeline pipeline descriptor to be added to the store
 * returns defaultResponse
 **/
exports.storePOST = function(pipeline) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "message" : "message"
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * delete stored pipeline
 * removes selected stored pipeline from store
 *
 * pipelineName String pipeline name to get from the store
 * returns defaultResponse
 **/
exports.storePipelineNameDELETE = function(pipelineName) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = {
  "message" : "message"
};
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}


/**
 * get pipeline data from store
 * returns stored pipeline
 *
 * pipelineName String pipeline name to get from the store
 * returns piplineNamesList
 **/
exports.storePipelineNameGET = function(pipelineName) {
  return new Promise(function(resolve, reject) {
    var examples = {};
    examples['application/json'] = "";
    if (Object.keys(examples).length > 0) {
      resolve(examples[Object.keys(examples)[0]]);
    } else {
      resolve();
    }
  });
}

