const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const triggersTree = require('./triggers-tree.json');
const webhookStub = require('./webhook');
const workerStub = require('./worker');

module.exports = {
    algorithms,
    pipelines,
    triggersTree,
    webhookStub,
    workerStub
};
