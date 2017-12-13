const Graph = require('graphlib').Graph;
const alg = require('graphlib').alg;
const deepExtend = require('deep-extend');
const groupBy = require('lodash.groupby');
const Node = require('lib/nodes/node');
const States = require('lib/state/States');
const inputParser = require('lib/parsers/input-parser');

class NodesMap {

    constructor(options) {
        this._graph = new Graph();
        const links = [];

        options.nodes.forEach(node => {
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
        if (!node) {
            throw new Error(`unable to find node ${nodeName}`)
        }
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
        if (!node) {
            throw new Error(`unable to find node ${nodeName}`)
        }
        if (batchID) {
            const batch = node.batch.find(b => b.batchID === batchID);
            if (!batch) {
                throw new Error(`unable to find batch ${batchID}`)
            }
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

    getNodeStates(nodeName) {
        let states = [];
        const node = this._graph.node(nodeName);
        if (!node) {
            throw new Error(`unable to find node ${nodeName}`)
        }
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
        const nodes = this.getAllNodes();
        nodes.forEach(n => {
            if (n.batch.length > 0) {
                states = states.concat(n.batch.map(b => b.state));
            }
            else {
                states.push(n.state);
            }
        })
        return states.every(s => s === States.SUCCEED || s === States.FAILED);
    }

    getAllNodes() {
        const nodes = this._graph.nodes();
        return nodes.map(n => this._graph.node(n));
    }

    parentsResults(node) {
        const parents = this.parents(node);
        const results = Object.create(null);
        parents.forEach(p => {
            results[p] = this.getNodeResults(p);
        })
        return results;
    }

    isAllParentsFinished(node) {
        const parents = this.parents(node);
        let states = [];
        parents.forEach(p => {
            states = states.concat(this.getNodeStates(p));
        })
        return states.every(s => s === States.SUCCEED || s === States.FAILED);
    }

    nodesResults() {
        const results = [];
        const nodes = this.getAllNodes();
        nodes.forEach(n => {
            const childs = this.childs(n.name);
            if (childs.length === 0) {
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
            }
        })
        return results;
    }

    calc() {
        const nodes = [];
        const nodesList = this.getAllNodes();
        nodesList.forEach(n => {
            if (n.batch.length > 0) {
                n.batch.forEach(b => nodes.push(b));
            }
            else {
                nodes.push(n);
            }
        })
        const groupedStates = groupBy(nodes, 'state');
        const succeed = groupedStates.succeed ? groupedStates.succeed.length : 0;
        const failed = groupedStates.failed ? groupedStates.failed.length : 0;
        const completed = succeed + failed;
        const progress = (completed / nodes.length * 100).toFixed(2);
        const states = Object.entries(groupedStates).map(([key, value]) => `${value.length} ${key}`);
        const details = `${progress}% completed, ${states.join(', ')}`;
        return { progress, details };
    }

    parents(node) {
        return this._graph.predecessors(node);
    }

    childs(node) {
        return this._graph.successors(node);
    }
}

module.exports = NodesMap;