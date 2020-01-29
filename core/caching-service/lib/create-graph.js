const graphlib = require('graphlib');
const { parser } = require('@hkube/parsers');

class NodesMap {
    constructor(_nodes) {
        this._graph = new graphlib.Graph({ directed: true });
        this.nodes = _nodes;
        this._buildGraph(this.nodes);
    }

    _buildGraph(_nodesData) {
        const nodes = [];
        const _nodes = _nodesData || [];
        _nodes.forEach((n) => {
            n.input.forEach((i) => {
                const results = parser.extractNodesFromInput(i);
                results.forEach((r) => {
                    let node = nodes.find(f => f.source === r.nodeName && f.target === n.nodeName);
                    if (!node) {
                        node = { source: r.nodeName, target: n.nodeName, edges: [{ type: r.type }] };
                        nodes.push(node);
                    }
                    else {
                        node.edges.push({ type: r.type });
                    }
                });
            });
            this._graph.setNode(n.nodeName, n);
        });

        nodes.forEach((n) => {
            this._graph.setEdge(n.source, n.target, n.edges);
        });
    }

    getAllPredecessors(nodeId, graph = this._graph, res = []) {
        const predecessors = graph.predecessors(nodeId);
        if (!predecessors) {
            throw new Error(`cant find predecessors for ${nodeId}`);
        }
        if (predecessors.length === 0) {
            return null;
        }
        res.push({ id: nodeId, predecessors });
        predecessors.forEach(p => this.getAllPredecessors(p, graph, res));
        return res;
    }

    getAllSuccessors(nodeId, graph = this._graph, res = []) {
        const successors = graph.successors(nodeId);
        if (!successors) {
            throw new Error(`cant find successors for ${nodeId}`);
        }
        if (successors.length === 0) {
            return null;
        }
        res.push({ id: nodeId, successors });
        successors.forEach(p => this.getAllSuccessors(p, graph, res));
        return res;
    }
}


module.exports = NodesMap;
