'use strict';

var utils = require('../utils/writer.js');
var Execution = require('../service/ExecutionService');

module.exports.resultsExecutionIDGET = function resultsExecutionIDGET (req, res, next) {
  var executionID = req.swagger.params['executionID'].value;
  Execution.resultsExecutionIDGET(executionID)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.runPOST = function runPOST (req, res, next) {
  var pipelineRunData = req.swagger.params['pipelineRunData'].value;
  Execution.runPOST(pipelineRunData)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.runStoredPOST = function runStoredPOST (req, res, next) {
  var storedpipelineRunData = req.swagger.params['storedpipelineRunData'].value;
  Execution.runStoredPOST(storedpipelineRunData)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.statusGET = function statusGET (req, res, next) {
  var flow_execution_id = req.swagger.params['flow_execution_id'].value;
  Execution.statusGET(flow_execution_id)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.stopPOST = function stopPOST (req, res, next) {
  var flow_execution_id = req.swagger.params['flow_execution_id'].value;
  var reason = req.swagger.params['reason'].value;
  Execution.stopPOST(flow_execution_id,reason)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};
