const EventEmitter = require('events');
const Graph = require('graphlib').Graph;
const alg = require('graphlib').alg;
const deepExtend = require('deep-extend');
const GroupBy = require('../helpers/group-by');
const throttle = require('lodash.throttle');
const Node = require('./node');
const WaitBatch = require('../nodes/node-wait-batch');
const VirtualNode = require('../graph/virtual-node');
const VirtualLink = require('../graph/virtual-link');
const ActualGraph = require('../graph/graph-actual');
const VirtualGraph = require('../graph/graph-virtual');
const NodeResult = require('./node-result');
const States = require('../state/States');
const { parser, consts } = require('@hkube/parsers');

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
        this._throttledCheckReadyNodes = throttle(this.checkReadyNodes.bind(this), 1000, { trailing: true, leading: true });
    }

    _buildGraph(options) {
        const nodes = [];
        options.nodes.forEach(n => {
            n.input.forEach(i => {
                const results = parser.extractNodesFromInput(i);
                results.forEach(r => {
                    let node = nodes.find(f => f.source === r.nodeName && f.target === n.nodeName);
                    if (!node) {
                        node = { source: r.nodeName, target: n.nodeName, edges: [{ type: r.type }] }
                        nodes.push(node);
                        this._graph.setEdge(node.source, node.target);
                    }
                    else {
                        node.edges.push({ type: r.type });
                    }
                })
            })

            const node = new Node({
                nodeName: n.nodeName,
                algorithmName: n.algorithmName,
                input: n.input,
                extraData: n.extraData
            });
            this._graph.setNode(node.nodeName, node);
        });

        this._buildVirtualGraph(nodes);
    }

    _buildVirtualGraph(nodes) {
        nodes.forEach(n => {
            let node = this._virtualGraph.findByTarget(n.target);
            if (!node) {
                node = new VirtualNode();
                this._virtualGraph.addNode(node);
            }
            node.links.push(new VirtualLink(n));
        });
    }

    checkReadyNodes() {
        const nodesToRun = [];
        const nodes = this._actualGraph.list;

        nodes.forEach(n => {
            let run = true;
            let nodeName = null;
            let index = null;
            let parentOutput = [];

            n.links.forEach(l => {
                nodeName = l.target;
                l.edges.forEach(e => {
                    if (e.index) {
                        index = e.index;
                    }
                    if (e.completed) {
                        parentOutput.push({ type: e.type, node: l.source, result: e.result, index: e.index });
                    }
                    else {
                        run = false;
                    }
                })
            })
            if (run) {
                nodesToRun.push({ id: n.id, nodeName, parentOutput, index });
            }
        })

        nodesToRun.forEach(n => {
            this._actualGraph.removeNode(n.id);
            this.emit('node-ready', n);
        });
    }

    _updateChildNode(task, target) {
        const source = task.nodeName;
        const index = task.batchIndex;
        const bNode = this._actualGraph.findByEdge(source, target);
        let aNode = this._actualGraph.findByTargetAndIndex(target, index);

        if ((!aNode && index) || (!aNode && !bNode)) {
            const vNode = this._virtualGraph.getCopy(source, target);
            this._actualGraph.addNode(vNode);
            aNode = vNode;
        }
        else if (!aNode && bNode) {
            aNode = bNode;
        }
        const link = aNode.links.find(l => l.source === source && l.target === target);
        link.edges.forEach(e => {
            if ((e.type === consts.relations.WAIT_ANY || e.type === consts.relations.WAIT_ANY_BATCH) && (index)) {
                e.completed = true;
                e.result = task.result;
                e.index = index;
            }
            else if (e.type === consts.relations.WAIT_NODE || e.type === consts.relations.WAIT_BATCH) {
                const completed = this.isNodeCompleted(source);
                if (completed) {
                    e.completed = true;
                    e.result = this.getNodeResults(source);
                    this._actualGraph.updateBySource(source, e.result);
                }
            }
        })
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

    updateCompletedTask(task, checkReadyNodes = true) {
        const childs = this._childs(task.nodeName);
        if (childs.length > 0) {
            childs.forEach(child => {
                this._updateChildNode(task, child);
            });
            if (checkReadyNodes) {
                this.checkReadyNodes();
            }
        }
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

    getWaitAny(nodeName, index) {
        let waitAny = null;
        const node = this._graph.node(nodeName);
        if (node) {
            waitAny = node.batch.find(b => b.waitIndex === index);
        }
        return waitAny;
    }

    addBatch(batch) {
        const node = this._graph.node(batch.nodeName);
        if (node) {
            node.batch.push(batch);
        }
        const childs = this._childs(batch.nodeName);
        childs.forEach(child => {
            const edge = this._virtualGraph.findEdge(batch.nodeName, child, consts.relations.WAIT_ANY);
            if (edge) {
                const node = this._graph.node(child);
                const waitIndex = node.batch.find(b => b.waitIndex === batch.batchIndex);
                if (!waitIndex) {
                    const waitAny = new WaitBatch({
                        nodeName: node.nodeName,
                        waitIndex: batch.batchIndex,
                        algorithmName: node.algorithmName,
                        extraData: node.extraData
                    });
                    node.batch.push(waitAny);
                }
            }
        });
    }

    setNode(node) {
        const n = this._graph.node(node.nodeName);
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
        return task;
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
        const groupBy = new GroupBy(nodes, 'status');
        const groupedStates = groupBy.group();
        const succeed = groupedStates.succeed ? groupedStates.succeed.length : 0;
        const failed = groupedStates.failed ? groupedStates.failed.length : 0;
        const completed = succeed + failed;
        const progress = (completed / nodes.length * 100).toFixed(2);
        const statesText = groupBy.text();
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
        const details = `${progress}% completed, ${statesText}`;
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