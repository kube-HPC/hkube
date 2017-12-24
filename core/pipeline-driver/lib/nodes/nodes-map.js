const EventEmitter = require('events');
const Graph = require('graphlib').Graph;
const alg = require('graphlib').alg;
const deepExtend = require('deep-extend');
const groupBy = require('lodash.groupby');
const Node = require('lib/nodes/node');
const NodeResult = require('lib/nodes/node-result');
const States = require('lib/state/States');
const inputParser = require('lib/parsers/input-parser');

class NodesMap extends EventEmitter {

    constructor(options) {
        super();
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
                        links.push({ source: gNode.nodeName, target: node.nodeName })
                    }
                })
                inputParser.checkFlowInput(options, inp);
            })
            this._graph.setNode(node.nodeName, new Node({ nodeName: node.nodeName, algorithmName: node.algorithmName, input: node.input }));
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
        else if (Array.isArray(node.result)) {
            results = node.result;
        }
        else {
            results.push(node.result);
        }
        return results;
    }

    addBatch(batch) {
        const node = this._graph.node(batch.nodeName);
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

    updateTaskState(taskId, options) {
        const task = this.getNodeByTaskID(taskId);
        if (!task) {
            throw new Error(`unable to find task ${taskId}`)
        }

        task.status = options.status;
        task.result = options.result;
        task.error = options.error;
        this.emit('state-changed', task);

        // if (task.batchID) {
        //     const node = this._graph.node(task.nodeName);
        //     const states = node.batch.map(n => n.status);
        //     const allCompleted = states.every(this._isCompleted);
        //     const sameState = states.every((val, i, arr) => val === arr[0]);
        //     const isActive = states.find(n => n.status === States.ACTIVE);
        //     if (allCompleted) {
        //         node.status = States.COMPLETED;
        //     }
        //     if (sameState) {
        //         node.status = options.status;
        //     }
        //     if (isActive) {
        //         node.status = States.ACTIVE;
        //     }
        // }
    }

    getNodeStates(nodeName) {
        let states = [];
        const node = this._graph.node(nodeName);
        if (!node) {
            throw new Error(`unable to find node ${nodeName}`)
        }
        if (node.batch.length > 0) {
            states = node.batch.map(n => n.status);
        }
        else {
            states.push(node.status);
        }
        return states;
    }

    isAllNodesDone() {
        const nodes = this._getNodesAsFlat();
        const states = nodes.map(n => n.status);
        return states.every(this._isCompleted);
    }

    _isCompleted(status) {
        return status === States.SUCCEED || status === States.FAILED;
    }

    _isIdle(status) {
        return status === States.CREATING || status === States.PENDING;
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
        return states.every(this._isCompleted);
    }

    nodesResults() {
        const results = [];
        const nodes = this.getAllNodes();
        nodes.forEach(n => {
            const childs = this.childs(n.nodeName);
            if (childs.length === 0) {
                if (n.batch.length > 0) {
                    n.batch.forEach(b => results.push(new NodeResult(b)));
                }
                else {
                    results.push(new NodeResult(n))
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
        const groupedStates = groupBy(nodes, 'status');
        const succeed = groupedStates.succeed ? groupedStates.succeed.length : 0;
        const failed = groupedStates.failed ? groupedStates.failed.length : 0;
        const completed = succeed + failed;
        const progress = (completed / nodes.length * 100).toFixed(2);
        const states = Object.entries(groupedStates).map(([key, value]) => `${value.length} ${key}`);
        const details = `${progress}% completed, ${states.join(', ')}`;
        const activeNodes = [];
        nodesList.forEach(n => {
            const node = {
                nodeName: n.nodeName,
                algorithmName: n.algorithmName
            }
            if (n.batch.length === 0 && n.status === States.ACTIVE) {
                activeNodes.push(node);
            }
            else if (n.batch.length > 0) {
                const batchStates = n.batch.map(n => n.status);
                const isIdle = batchStates.every(this._isIdle);
                const allCompleted = batchStates.every(this._isCompleted);
                if (!allCompleted && !isIdle) {
                    const active = n.batch.filter(n => this._isCurrentRunning(n.status));
                    if (active.length > 0) {
                        node.batch = {
                            active: active.length,
                            total: n.batch.length
                        }
                        activeNodes.push(node);
                    }
                }
            }
        })
        return { progress, details, activeNodes };
    }

    _getNodesAsFlat() {
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
        return nodes;
    }

    getNodeByTaskID(taskId) {
        const nodes = this._getNodesAsFlat();
        return nodes.find(n => n.taskId === taskId);
    }

    _isCurrentRunning(status) {
        return this._isCompleted(status) || status === States.ACTIVE;
    }

    parents(node) {
        return this._graph.predecessors(node);
    }

    childs(node) {
        return this._graph.successors(node);
    }
}

module.exports = NodesMap;