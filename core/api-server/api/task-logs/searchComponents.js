const { nodeKind } = require('@hkube/consts');
const { components, containers } = require('./consts');

const getSearchComponent = (kind) => {
    switch (kind) {
    case nodeKind.DataSource:
        return [components.Consumer];
    case containers.pipelineDriver:
        return [];
    case nodeKind.Algorithm:
    case nodeKind.Debug:
    case nodeKind.Gateway:
    case containers.worker:
        return [components.Algorunner];
    default:
        throw new Error(`invalid node kind ${kind}`);
    }
};

module.exports = {
    getSearchComponent,
};
