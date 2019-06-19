const workerTemplate = require('./worker');
const pipelineDriverTemplate = require('./pipeline-driver');

module.exports = {
    ...workerTemplate,
    pipelineDriverTemplate
};
