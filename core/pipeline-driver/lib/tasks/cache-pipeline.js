const { parser } = require('@hkube/parsers');
const stateManager = require('../state/state-manager');

class Cache {
    constructor() {
        this.cacheJobId = undefined;
    }

    async checkCachePipeline(nodes) {
        const node = nodes.find(n => n.cacheJobId);
        if (node) {
            this.cacheJobId = node.cacheJobId;
            const jobId = node.cacheJobId;
            const graph = await stateManager.getGraph({ jobId });
            if (!graph) {
                throw new Error(`unable to find graph for job ${jobId}`);
            }
            await Promise.all(nodes.map((n) => this._getResultFromPredecessors(graph, n, node.cacheJobId)));
            return true;
        }
        return false;
    }

    async _getResultFromPredecessors(graph, node, cacheJobId) {
        const nodes = this._splitInputToNodes(node.input);
        const parentOutput = [];
        await Promise.all(Array.from(nodes, (async ([, n]) => {
            const data = await this._getNodeResult(graph, n.nodeName, cacheJobId);
            if (data) {
                data.type = n.type;
                parentOutput.push(data);
            }
        })));
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

    async _getNodeResult(graph, nodeName, cacheJobId) {
        let result;
        const node = graph.nodes.find(n => n.nodeName === nodeName);
        const tasks = await stateManager.getTasks({ jobId: cacheJobId, nodeName });
        if (node.batchInfo) {
            result = { node: nodeName, result: tasks.map(b => b.result) };
        }
        else {
            result = { node: nodeName, result: tasks[0].result };
        }
        return result;
    }
}

module.exports = new Cache();
