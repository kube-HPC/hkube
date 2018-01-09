const EventEmitter = require('events');
const uuidv4 = require('uuid/v4');
const Graph = require('graphlib').Graph;
const alg = require('graphlib').alg;
const clone = require('clone');
const deepExtend = require('deep-extend');
const groupBy = require('lodash.groupby');
const Node = require('lib/nodes/node');
const ActualGraph = require('lib/graph/graph-actual');
const VirtualGraph = require('lib/graph/graph-virtual');
const createEdge = require('lib/nodes/edge');
const NodeResult = require('lib/nodes/node-result');
const States = require('lib/state/States');
const inputParser = require('lib/parsers/input-parser');

/**
 * This class responsible for handling the 
 * entire pipeline nodes data structure
 * 
 * @class NodesMap
 * @extends {EventEmitter}
 */
class NodesMap extends EventEmitter {

    constructor(options) {
        super();
        this._virtualGraph = new VirtualGraph();
        this._actualGraph = new ActualGraph();
        this._graph = new Graph({ directed: true });
        this._buildGraph(options);
    }

    _buildGraph(options) {
        const nodes = [];
        options.nodes.forEach(n => {
            n.input.forEach(i => {
                const results = inputParser.extractNodesFromInput(i);
                results.forEach(r => {
                    let node = nodes.find(f => f.source === r.nodeName && f.target === n.nodeName);
                    if (!node) {
                        node = { source: r.nodeName, target: n.nodeName, edge: createEdge(r) }
                        nodes.push(node);
                        this._graph.setEdge(node.source, node.target);
                    }
                    else {
                        node.edge.waitNode = r.isWaitNode || node.edge.waitNode;
                        node.edge.waitBatch = r.isWaitBatch || node.edge.waitBatch;
                        node.edge.waitAnyBatch = r.isWaitAnyBatch || node.edge.waitAnyBatch;
                    }
                })
            })

            const graphNode = new Node({
                nodeName: n.nodeName,
                algorithmName: n.algorithmName,
                input: n.input
            });
            this._graph.setNode(n.nodeName, graphNode);
        });

        this._buildVirtualGraph(nodes);
    }

    _buildVirtualGraph(nodes) {
        nodes.forEach(n => {
            let node = this._virtualGraph.findByTarget(n.target);
            if (!node) {
                node = {
                    id: uuidv4(),
                    links: []
                };
                this._virtualGraph.addNode(node);
            }
            const edges = Object.entries(n.edge).filter(([k, v]) => v).map(e => ({ type: e[0] }));
            node.links.push({ source: n.source, target: n.target, edges: edges });
        });
    }

    _checkReadyNodes() {
        const nodes = this._actualGraph.list;
        nodes.forEach(n => {
            let run = true;
            let nodeName = null;
            let index = null;
            let parentOutput = [];

            n.links.forEach(l => {
                nodeName = l.target;
                l.edges.forEach(e => {
                    if (!e.completed) {
                        run = false
                    }
                    if (e.index) {
                        index = e.index;
                    }
                    parentOutput.push({ type: e.type, node: e.node, result: e.result, index: e.index });
                })
            })
            if (run) {
                //n.run = true;
                this._actualGraph.removeNode(n.id);
                this.emit('node-ready', { nodeName, parentOutput, index });
            }
        })
    }

    _updateVirtual(task, target) {
        let node = task.nodeName;
        let index = task.batchIndex;
        let bNode = this._actualGraph.findByEdge(node, target);
        let aNode = this._actualGraph.findByTargetAndIndex(target, index);

        if (!aNode || !bNode) {
            const vNode = this._virtualGraph.findByEdge(node, target);
            const n = clone(vNode);
            n.id = uuidv4();
            this._actualGraph.addNode(n);
            aNode = n;
        }

        let link = aNode.links.find(l => l.source === node && l.target === target);

        link.edges.forEach(e => {
            if (e.type === 'waitAnyBatch' && index) {
                e.node = node;
                e.completed = true;
                e.result = task.result;
                e.index = index;
            }
            if (e.type === 'waitNode') {
                let completed = this.isNodeCompleted(node);
                if (completed) {
                    e.node = node;
                    e.completed = true;
                    e.result = this.getNodeResults(node);
                    this._actualGraph.updateBySource(node, e.result);
                }
            }
        })
    }

    _getActualNodes() {
        return this._actualGraph.list;
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

    _isCompleted(status) {
        return status === States.SUCCEED || status === States.FAILED;
    }

    _isIdle(status) {
        return status === States.CREATING || status === States.PENDING;
    }

    _isCurrentRunning(status) {
        return this._isCompleted(status) || status === States.ACTIVE;
    }

    _parents(node) {
        return this._graph.predecessors(node);
    }

    _childs(node) {
        return this._graph.successors(node);
    }

    updateCompletedTask(task) {
        const childs = this._childs(task.nodeName);
        childs.forEach(child => {
            this._updateVirtual(task, child);
        });
        this._checkReadyNodes();
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
        let results = null;
        const node = this._graph.node(nodeName);
        if (!node) {
            throw new Error(`unable to find node ${nodeName}`)
        }
        if (node.batch.length > 0) {
            results = node.batch.map(n => n.result);
        }
        else {
            results = node.result;
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

    updateTaskState(taskId, { status, result, error } = {}) {
        const task = this.getNodeByTaskID(taskId);
        if (!task) {
            throw new Error(`unable to find task ${taskId}`)
        }
        deepExtend(task, { status, result, error });
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

    isAllNodesCompleted() {
        const nodes = this._getNodesAsFlat();
        const states = nodes.map(n => n.status);
        return states.every(this._isCompleted);
    }

    isNodeCompleted(nodeName) {
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
        return states.every(this._isCompleted);
    }

    getAllNodes() {
        const nodes = this._graph.nodes();
        return nodes.map(n => this._graph.node(n));
    }

    parentsResults(node) {
        const parents = this._parents(node);
        const results = Object.create(null);
        parents.forEach(p => {
            results[p] = this.getNodeResults(p);
        })
        return results;
    }

    resultsForBatchIndex(nodeName, batchIndex) {
        let results = null;
        const node = this._graph.node(nodeName);
        const batch = node.batch.find(n => n.batchIndex === batchIndex);
        if (batch && batch.status === States.SUCCEED) {
            results = batch.result;
        }
        return results;
    }

    isAllParentsFinished(node) {
        const parents = this._parents(node);
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
            const childs = this._childs(n.nodeName);
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

    calcProgress() {
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
        const statesText = Object.entries(groupedStates).map(([key, value]) => `${value.length} ${key}`);
        const states = nodes
            .map(n => n.status)
            .reduce((prev, cur) => {
                if (cur in prev) {
                    prev[cur]++;
                }
                else {
                    prev[cur] = 1;
                }
                return prev;
            }, {});
        const details = `${progress}% completed, ${statesText.join(', ')}`;
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
        return { progress, details, states, activeNodes };
    }

    getNodeByTaskID(taskId) {
        const nodes = this._getNodesAsFlat();
        return nodes.find(n => n.taskId === taskId);
    }
}

module.exports = NodesMap;