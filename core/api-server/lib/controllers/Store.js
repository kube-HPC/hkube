'use strict';

var utils = require('../utils/writer.js');
var Store = require('../service/StoreService');

module.exports.storeGET = function storeGET (req, res, next) {
  Store.storeGET()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.storePOST = function storePOST (req, res, next) {
  var pipeline = req.swagger.params['pipeline'].value;
  Store.storePOST(pipeline)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.storePipelineNameDELETE = function storePipelineNameDELETE (req, res, next) {
  var pipelineName = req.swagger.params['pipelineName'].value;
  Store.storePipelineNameDELETE(pipelineName)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.storePipelineNameGET = function storePipelineNameGET (req, res, next) {
  var pipelineName = req.swagger.params['pipelineName'].value;
  Store.storePipelineNameGET(pipelineName)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};
