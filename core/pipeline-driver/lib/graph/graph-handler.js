const Graph = require('graphlib').Graph;
const alg = require('graphlib').alg;

class GraphHandler {

    constructor(options) {
        options.links = options.links || [];
        this._graph = new Graph();

        if (!Array.isArray(options.nodes)) {
            throw new ReferenceError('nodes');
        }
        options.nodes.forEach(node => {
            this._graph.setNode(node.nodeName, node);
        });
        options.links.forEach(link => {
            this._graph.setEdge(link.source, link.target);
        });
    }

    findEntryNodes() {
        const nodes = this._graph.nodes();
        const targets = this._graph.edges().map(l => l.w);
        return nodes.filter(n => targets.indexOf(n) < 0);
    }

    node(node) {
        return this._graph.node(node);
    }

    isAcyclic() {
        return alg.isAcyclic(this._graph);
    }

    isDirected() {
        return this._graph.isDirected();
    }

    findCycles() {
        return alg.findCycles(this._graph);
    }

    parents(node) {
        return this._graph.predecessors(node);
    }

    childs(node) {
        return this._graph.successors(node);
    }
}

module.exports = GraphHandler;