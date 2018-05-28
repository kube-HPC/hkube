const EventEmitter = require('events');
const { Graph } = require('graphlib');
const deepExtend = require('deep-extend');
const GroupBy = require('../helpers/group-by');
const GraphNode = require('./graph-node');
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
        this._graph = new Graph({ directed: true });
        this._buildGraph(options);
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
                    }
                    else {
                        node.edges.push({ type: r.type });
                    }
                })
            })
            this._graph.setNode(n.nodeName, new GraphNode(n));
        });

        nodes.forEach(n => {
            this._graph.setEdge(n.source, n.target, n.edges);
        });
    }

    _checkChildNode(source, target, index) {
        let nodeResults = [];
        let completed = false;
        const edges = this._graph.edge(source, target).map(e => e.type);

        if (this._isWaitAny(edges) && this._isWaitNode(edges)) {
            index = null;
            completed = this.isAllParentsFinished(target);
        }
        else if (this._isWaitAny(edges) && index) {
            completed = this.isAllParentsFinishedIndex(target, index);
        }
        else if (this._isWaitNode(edges)) {
            index = null;
            completed = this.isAllParentsFinished(target);
        }
        if (completed) {
            nodeResults = this._analyzeResults(target, index);
            nodeResults.forEach(n => {
                this.emit('node-ready', n);
            })
        }
        return nodeResults;
    }

    _analyzeResults(target, index) {
        const nodeResults = [];
        const parentOutput = [];
        const parents = this._parents(target);
        parents.forEach(p => {
            const node = this._graph.node(p)
            const edges = this._graph.edge(p, target).map(e => e.type);
            if (this._isWaitNode(edges)) {
                parentOutput.push({
                    type: consts.relations.WAIT_NODE,
                    node: p,
                    result: this.getNodeResults(node.nodeName)
                });
            }
            if (this._isWaitAny(edges)) {
                node.batch.forEach(b => {
                    if (!index || index === b.batchIndex) {
                        parentOutput.push({
                            type: consts.relations.WAIT_ANY,
                            node: b.nodeName,
                            result: b.result,
                            index: b.batchIndex
                        });
                    }
                });
            }
        });
        if (parentOutput.length > 0) {
            const groupBy = new GroupBy(parentOutput, 'index');
            const group = groupBy.group();
            const waitNodes = group["undefined"];
            const keys = Object.keys(group);
            delete group["undefined"];
            if (waitNodes && keys.length === 1) {
                nodeResults.push({ nodeName: target, parentOutput: waitNodes });
            }
            else {
                Object.entries(group).forEach(([k, v]) => {
                    const index = parseInt(k);
                    if (waitNodes) {
                        const parentResults = [...waitNodes, ...v];
                        nodeResults.push({ nodeName: target, parentOutput: parentResults, index });
                    }
                    else {
                        nodeResults.push({ nodeName: target, parentOutput: v, index });
                    }
                })
            }
        }
        return nodeResults;
    }

    _isWaitAny(edges) {
        return edges.includes(consts.relations.WAIT_ANY) || edges.includes(consts.relations.WAIT_ANY_BATCH);
    }

    _isWaitNode(edges) {
        return edges.includes(consts.relations.WAIT_NODE) || edges.includes(consts.relations.WAIT_BATCH);
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

    extractPaths(nodeName) {
        const paths = [];
        const childs = this._childs(nodeName);
        childs.forEach(c => {
            const child = this.getNode(c);
            child.input.forEach(i => {
                const nodes = parser.extractNodesFromInput(i)
                    .filter(n => n.nodeName === nodeName)
                    .map(n => n.path);
                paths.push(...nodes);
            })
        });
        return paths;
    }

    updateCompletedTask(task) {
        const childs = this._childs(task.nodeName);
        return childs.map(child => this._checkChildNode(task.nodeName, child, task.batchIndex));
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

    isAllParentsFinished(node) {
        const parents = this._parents(node);
        let states = [];
        parents.forEach(p => {
            states = states.concat(this.getNodeStates(p));
        })
        return states.every(this._isCompleted);
    }

    _parentNodes(node) {
        const parents = this._parents(node);
        return parents.map(p => this._graph.node(p));
    }

    isAllParentsFinishedIndex(node, index) {
        const parents = this._parents(node);
        const states = parents.map(p => {
            const node = this._graph.node(p);
            const batch = node.batch.find(b => b.batchIndex === index);
            if (batch) {
                return batch.status;
            }
        });
        return states.every(this._isCompleted);
    }

    getParentsResultsIndex(node, index) {
        const parents = this._parents(node);
        return parents.map(p => {
            const node = this._graph.node(p);
            const batch = node.batch.find(b => b.batchIndex === index);
            return { parent: p, result: batch.result };
        });
    }

    pipelineResults() {
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
        const progress = parseFloat((completed / nodes.length * 100).toFixed(2));
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