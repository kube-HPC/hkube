const Graph = require('graphlib').Graph;
const alg = require('graphlib').alg;
const inputParser = require('lib/parsers/input-parser');

class GraphHandler {

    constructor(options) {
        this._graph = new Graph();

        options.nodes.forEach(node => {
            this._graph.setNode(node.nodeName, node);
        });

        const links = [];
        options.nodes.forEach(node => {
            node.input.forEach(input => {
                if ((typeof input === 'string') && (input.charAt(0) === '@' || input.charAt(0) === '#')) {
                    const nodeName = input.substr(1);
                    const result = inputParser.extractObject(nodeName);
                    const n = this._graph.node(result.object);
                    if (n) {
                        links.push({ source: n.nodeName, target: node.nodeName })
                    }
                }
            })
        });

        links.forEach(link => {
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