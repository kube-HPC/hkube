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
        const { jobId, node, sort, order, from, to } = options;
        const json = await graphAdapter.getGraph({ key: jobId });
        const graph = JSON.parse(json);
        if (!graph) {
            throw new ResourceNotFoundError('graph', jobId);
        }
        if (node) {
            graph.nodes = graph.nodes.filter(n => n.nodeName === node);
            graph.edges = graph.edges.filter(n => n.from === node || n.to === node);
            if (graph.nodes.length === 0) {
                throw new ResourceNotFoundError('node', node);
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
