const Graph = require('graphlib').Graph;
const alg = require('graphlib').alg;
const deepExtend = require('deep-extend');
const Node = require('lib/nodes/node');
const States = require('lib/state/States');
const inputParser = require('lib/parsers/input-parser');

class NodesHandler {

    constructor(options) {

        const nodes = options.nodes.map((item) => item.nodeName);
        const duplicates = this._findDuplicates(nodes);

        if (duplicates.length > 0) {
            throw new Error(`found duplicate nodes ${duplicates.join(',')}`);
        }

        this._graph = new Graph();
        const links = [];

        options.nodes.forEach(node => {
            if (node.nodeName === 'flowInput') {
                throw new Error(`node ${node.nodeName} has invalid reserved name flowInput`);
            }
            if (!Array.isArray(node.input)) {
                throw new Error(`node ${node.nodeName} input must be an array`);
            }
            const batchIndex = inputParser.batchInputIndex(node.input);
            const waitAnyIndex = inputParser.waitAnyInputIndex(node.input);
            if (batchIndex > -1 && waitAnyIndex > -1) {
                throw new Error(`node ${node.nodeName} input cannot be batch and waitAny`);
            }
            node.input.forEach((inp, ind) => {
                const nodes = inputParser.extractNodesFromInput(inp);
                nodes.forEach(n => {
                    const gNode = this._graph.node(n);
                    if (gNode) {
                        links.push({ source: gNode.name, target: node.nodeName })
                    }
                    else {
                        throw new Error(`node ${node.nodeName} is depend on ${n} which not exists`);
                    }
                })
                inputParser.checkFlowInput(options, inp);
            })
            this._graph.setNode(node.nodeName, new Node({ name: node.nodeName, algorithm: node.algorithmName, input: node.input }));
        });
        links.forEach(link => {
            this._graph.setEdge(link.source, link.target);
        });
    }

    _findDuplicates(data) {
        let result = [];
        data.forEach((element, index) => {
            if (data.indexOf(element, index + 1) > -1) {
                if (result.indexOf(element) === -1) {
                    result.push(element);
                }
            }
        });
        return result;
    }

    findEntryNodes() {
        const nodes = this._graph.nodes();
        const targets = this._graph.edges().map(l => l.w);
        return nodes.filter(n => targets.indexOf(n) < 0);
    }

    getNode(name) {
        return this._graph.node(name);
    }

    getNodeResults(nodeName) {
        let results = [];
        const node = this._graph.node(nodeName);
        if (node.batch.length > 0) {
            results = node.batch.map(n => n.result);
        }
        else {
            results.push(node.result);
        }
        return results;
    }

    addBatch(batch) {
        const node = this._graph.node(batch.name);
        if (node) {
            node.batch.push(batch);
        }
    }

    setNode(name, node) {
        const n = this._graph.node(name);
        if (n) {
            deepExtend(n, node);
        }
    }

    updateNodeState(nodeName, batchID, options) {
        const node = this._graph.node(nodeName);
        if (batchID) {
            const batch = node.batch.find(b => b.batchID === batchID);
            batch.state = options.state;
            batch.result = options.result;
            batch.error = options.error;
        }
        else {
            node.state = options.state;
            node.result = options.result;
            node.error = options.error;
        }
    }

    getNodeState(nodeName, batchID) {
        const node = this._graph.node(nodeName);
        if (batchID) {
            const batch = node.batch.find(b => b.batchID === batchID);
            return batch.state;
        }
        return node.state;
    }

    getNodeStates(nodeName) {
        let states = [];
        const node = this._graph.node(nodeName);
        if (node.batch.length > 0) {
            states = node.batch.map(n => n.state);
        }
        else {
            states.push(node.state);
        }
        return states;
    }

    isAllNodesDone() {
        let states = [];
        const nodesNames = this._graph.nodes();
        const nodes = nodesNames.map(n => this._graph.node(n));
        nodes.forEach(n => {
            if (n.batch.length > 0) {
                states = states.concat(n.batch.map(b => b.state));
            }
            else {
                states.push(n.state);
            }
        })
        return states.every(s => s === States.FAILED || s === States.COMPLETED);
    }

    nodeResults(nodeName) {
        let results = [];
        const node = this._graph.node(nodeName);
        if (node.batch.length > 0) {
            results = node.batch.map(n => n.result);
        }
        else {
            results.push(node.result);
        }
        return results;
    }

    parentsResults(node) {
        const parents = this.parents(node);
        const results = Object.create(null);
        parents.forEach(p => {
            results[p] = this.nodeResults(p);
        })
        return results;
    }

    isAllParentsFinished(node) {
        const parents = this.parents(node);
        let states = [];
        parents.forEach(p => {
            states = states.concat(this.getNodeStates(p));
        })
        return states.every(s => s === States.COMPLETED);
    }

    allNodesResults() {
        const results = [];
        const nodesNames = this._graph.nodes();
        const nodes = nodesNames.map(n => this._graph.node(n));
        nodes.forEach(n => {
            if (n.batch.length > 0) {
                n.batch.forEach(b => results.push({
                    name: b.name,
                    batchID: b.batchID,
                    algorithm: b.algorithm,
                    result: b.result
                }));
            }
            else {
                results.push({
                    name: n.name,
                    algorithm: n.algorithm,
                    result: n.result
                })
            }
        })
        return results;
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

module.exports = NodesHandler;