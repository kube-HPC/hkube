const algorithms = require('./algorithms.json');
const pipelines = require('./pipelines.json');
const experiments = require('./experiments.json');
const triggersTree = require('./triggers-tree.json');
const workerStub = require('./worker');

module.exports = {
    algorithms,
    pipelines,
    experiments,
    triggersTree,
    workerStub
};
