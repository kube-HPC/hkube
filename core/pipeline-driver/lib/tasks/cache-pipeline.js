const { parser } = require('@hkube/parsers');
const graphStore = require('../datastore/graph-store');

class Cache {
    async _checkCachePipeline(nodes) {
        const node = nodes.find(n => n.cacheJobId);
        if (node) {
            const jobId = node.cacheJobId;
            const graph = await graphStore.getGraph({ jobId });
            if (!graph) {
                throw new Error(`unable to find graph for job ${jobId}`);
            }
            nodes.forEach((n) => {
                this._getResultFromPredecessors(graph, n);
            });
            return true;
        }
        return false;
    }

    _getResultFromPredecessors(graph, node) {
        const nodes = this._splitInputToNodes(node.input);
        const parentOutput = [];
        nodes.forEach((n) => {
            const data = this._getNodeResult(graph, n.nodeName);
            if (data) {
                data.type = n.type;
                parentOutput.push(data);
            }
        });
        node.parentOutput = parentOutput.length === 0 ? null : parentOutput;
    }

    _splitInputToNodes(input) {
        const newNodes = new Map();
        input.forEach((i) => {
            const nodesNames = parser.extractNodesFromInput(i);
            nodesNames.forEach(n => {
                newNodes.set(n.nodeName, n);
            });
        });
        return newNodes;
    }

    _getNodeResult(graph, nodeName) {
        let result;
        const node = graph.nodes.find(n => n.nodeName === nodeName);

        if (node.batch && node.batch.length > 0) {
            result = { node: nodeName, result: node.batch.map(b => b.output) };
        }
        else {
            result = { node: nodeName, result: node.output };
        }
        return result;
    }
}

module.exports = new Cache();
