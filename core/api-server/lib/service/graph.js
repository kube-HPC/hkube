const orderBy = require('lodash.orderby');
const validator = require('../validation/api-validator');
const graphAdapter = require('../state/graph-adapter');
const { ResourceNotFoundError } = require('../errors');

class AlgorithmVersions {
    async getGraphRaw(options) {
        validator.validateJobID(options);
        const { jobId } = options;
        const graph = await graphAdapter.getGraph({ key: jobId });
        if (!graph) {
            throw new ResourceNotFoundError('graph', jobId);
        }
        return graph;
    }

    async getGraphParsed(options) {
        validator.validateGraphQuery(options);
        const { jobId, nodeName, sort, order, from, to } = options;
        const graph = await graphAdapter.getGraph({ key: jobId, shouldParse: true });
        if (!graph) {
            throw new ResourceNotFoundError('graph', jobId);
        }
        if (nodeName) {
            graph.nodes = graph.nodes.filter(n => n.nodeName === nodeName);
            if (graph.nodes.length === 0) {
                throw new ResourceNotFoundError('node', nodeName);
            }
        }
        graph.nodes = graph.nodes.map((n) => {
            let batch;
            if (n.batch) {
                batch = n.batch.slice(from, to);
                batch = orderBy(batch, sort, order);
            }
            return { ...n, batch };
        });
        return graph;
    }
}

module.exports = new AlgorithmVersions();
