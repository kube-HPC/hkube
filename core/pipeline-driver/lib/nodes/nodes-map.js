const EventEmitter = require('events');
const graphlib = require('graphlib');
const deepExtend = require('deep-extend');
const { parser, consts } = require('@hkube/parsers');
const GroupBy = require('../helpers/group-by');
const GraphNode = require('./graph-node');
const NodeResult = require('./node-result');
const States = require('../state/NodeStates');

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
        this.calcProgress = this.calcProgress.bind(this);
        this._graph = new graphlib.Graph({ directed: true });
        this._buildGraph(options);
    }

    _buildGraph(options) {
        const nodes = [];
        options.nodes = options.nodes || [];
        options.nodes.forEach((n) => {
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
            this._graph.setNode(n.nodeName, new GraphNode(n));
        });

        nodes.forEach((n) => {
            this._graph.setEdge(n.source, n.target, n.edges);
        });
    }

    _checkChildNode(source, target, index) {
        let nodeResults = [];
        let completed = false;
        const edges = this._graph.edge(source, target).map(e => e.type);

        if ((this._isWaitAny(edges)) && (this._isWaitNode(edges) || this._isWaitBatch(edges))) {
            index = null;
            completed = this.isAllParentsFinished(target);
        }
        else if (this._isWaitAny(edges) && index) {
            completed = this.isAllParentsFinishedIndex(target, index);
        }
        else if (this._isWaitNode(edges) || this._isWaitBatch(edges)) {
            index = null;
            completed = this.isAllParentsFinished(target);
        }
        if (completed) {
            nodeResults = this._analyzeResults(target, index);
            nodeResults.forEach((n) => {
                this.emit('node-ready', n);
            });
        }
        return nodeResults;
    }

    _analyzeResults(target, index) {
        const nodeResults = [];
        const parentOutput = [];
        const parents = this._parents(target);
        parents.forEach((p) => {
            const node = this.getNode(p);
            const edges = this._graph.edge(p, target).map(e => e.type);
            if (this._isWaitNode(edges)) {
                parentOutput.push({
                    type: consts.relations.WAIT_NODE,
                    node: p,
                    result: this.getNodeResults(node.nodeName)
                });
            }
            if (this._isWaitBatch(edges)) {
                parentOutput.push({
                    type: consts.relations.WAIT_BATCH,
                    node: p,
                    result: this.getNodeResults(node.nodeName)
                });
            }
            if (this._isWaitAny(edges)) {
                if (node.batch.length > 0) {
                    node.batch.forEach((b) => {
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
                else {
                    parentOutput.push({
                        type: consts.relations.WAIT_ANY,
                        node: node.nodeName,
                        result: node.result
                    });
                }
            }
        });
        if (parentOutput.length > 0) {
            const groupBy = new GroupBy(parentOutput, 'index');
            const group = groupBy.group();
            const waitNodes = group.undefined;
            const keys = Object.keys(group);
            delete group.undefined;
            if (waitNodes && keys.length === 1) {
                nodeResults.push({ nodeName: target, parentOutput: waitNodes });
            }
            else {
                Object.entries(group).forEach(([k, v]) => {
                    const ind = parseInt(k, 10);
                    if (waitNodes) {
                        const parentResults = [...waitNodes, ...v];
                        nodeResults.push({ nodeName: target, parentOutput: parentResults, index: ind });
                    }
                    else {
                        nodeResults.push({ nodeName: target, parentOutput: v, index: ind });
                    }
                });
            }
        }
        return nodeResults;
    }

    _isWaitAny(edges) {
        return edges.includes(consts.relations.WAIT_ANY) || edges.includes(consts.relations.WAIT_ANY_BATCH);
    }

    _isWaitNode(edges) {
        return edges.includes(consts.relations.WAIT_NODE);
    }

    _isWaitBatch(edges) {
        return edges.includes(consts.relations.WAIT_BATCH);
    }

    _getNodesAsFlat() {
        const nodes = [];
        const nodesList = this.getAllNodes();
        nodesList.forEach((n) => {
            if (n.batch.length > 0) {
                n.batch.forEach(b => nodes.push(b));
            }
            else {
                nodes.push(n);
            }
        });
        return nodes;
    }

    _isCompleted(status) {
        return status === States.SUCCEED || status === States.FAILED || status === States.SKIPPED;
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
        childs.forEach((c) => {
            const child = this.getNode(c);
            child.input.forEach((i) => {
                const nodes = parser.extractNodesFromInput(i)
                    .filter(n => n.nodeName === nodeName)
                    .map(n => n.path);
                paths.push(...nodes);
            });
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
        const node = this.getNode(nodeName);
        if (!node) {
            throw new Error(`unable to find node ${nodeName}`);
        }
        if (node.status === States.SKIPPED) {
            results = [];
        }
        else if (node.batch.length > 0) {
            results = node.batch.map(n => n.result);
        }
        else {
            results = node.result;
        }
        return results;
    }

    addBatch(batch) {
        const node = this.getNode(batch.nodeName);
        if (node) {
            node.batch.push(batch);
        }
    }

    setNode(node) {
        const n = this.getNode(node.nodeName);
        if (n) {
            deepExtend(n, node);
        }
    }

    updateTaskState(taskId, { status, result, error } = {}) {
        const task = this.getNodeByTaskID(taskId);
        if (!task) {
            throw new Error(`unable to find task ${taskId}`);
        }
        deepExtend(task, { status, result, error });
        return task;
    }

    getNodeStates(nodeName) {
        let states = [];
        const node = this.getNode(nodeName);
        if (!node) {
            throw new Error(`unable to find node ${nodeName}`);
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
        const node = this.getNode(nodeName);
        if (!node) {
            throw new Error(`unable to find node ${nodeName}`);
        }
        if (node.batch.length > 0) {
            states = node.batch.map(n => n.status);
        }
        else {
            states.push(node.status);
        }
        return states.every(this._isCompleted);
    }

    getJSONGraph() {
        return graphlib.json.write(this._graph);
    }

    setJSONGraph(graph) {
        this._graph = graphlib.json.read(graph);
    }

    getAllNodes() {
        const nodes = this._graph.nodes();
        return nodes.map(n => this.getNode(n));
    }

    isAllParentsFinished(node) {
        const parents = this._parents(node);
        let states = [];
        parents.forEach((p) => {
            states = states.concat(this.getNodeStates(p));
        });
        return states.every(this._isCompleted);
    }

    _parentNodes(node) {
        const parents = this._parents(node);
        return parents.map(p => this.getNode(p));
    }

    isAllParentsFinishedIndex(nodeName, index) {
        const parents = this._parents(nodeName);
        const states = parents.map((p) => {
            const node = this.getNode(p);
            const batch = node.batch.find(b => b.batchIndex === index);
            return batch && batch.status;
        });
        return states.every(this._isCompleted);
    }

    getParentsResultsIndex(nodeName, index) {
        const parents = this._parents(nodeName);
        return parents.map((p) => {
            const node = this.getNode(p);
            const batch = node.batch.find(b => b.batchIndex === index);
            return { parent: p, result: batch.result };
        });
    }

    pipelineResults() {
        const results = [];
        const nodes = this.getAllNodes();
        nodes.forEach((n) => {
            const childs = this._childs(n.nodeName);
            if (childs.length === 0) {
                if (n.batch.length > 0) {
                    n.batch.forEach(b => results.push(new NodeResult(b)));
                }
                else {
                    results.push(new NodeResult(n));
                }
            }
        });
        return results;
    }

    calcProgress() {
        const calc = {
            progress: 0,
            details: '',
            states: {},
            activeNodes: []
        };
        const nodesList = this.getAllNodes();
        if (nodesList.length === 0) {
            return calc;
        }
        const nodes = [];
        nodesList.forEach((n) => {
            if (n.batch.length > 0) {
                n.batch.forEach(b => nodes.push(b));
            }
            else {
                nodes.push(n);
            }
        });
        const groupBy = new GroupBy(nodes, 'status');
        const groupedStates = groupBy.group();
        const succeed = groupedStates.succeed ? groupedStates.succeed.length : 0;
        const failed = groupedStates.failed ? groupedStates.failed.length : 0;
        const skipped = groupedStates.skipped ? groupedStates.skipped.length : 0;
        const completed = succeed + failed + skipped;
        calc.progress = parseFloat(((completed / nodes.length) * 100).toFixed(2));
        const statesText = groupBy.text();
        calc.states = nodes.map(n => n.status).reduce((prev, cur) => {
            if (cur in prev) {
                prev[cur] += 1;
            }
            else {
                prev[cur] = 1;
            }
            return prev;
        }, {});
        calc.details = `${calc.progress}% completed, ${statesText}`;
        nodesList.forEach((n) => {
            const node = {
                nodeName: n.nodeName,
                algorithmName: n.algorithmName
            };
            if (n.batch.length === 0 && n.status === States.ACTIVE) {
                calc.activeNodes.push(node);
            }
            else if (n.batch.length > 0) {
                const batchStates = n.batch.map(b => b.status);
                const isIdle = batchStates.every(this._isIdle);
                const allCompleted = batchStates.every(this._isCompleted);
                if (!allCompleted && !isIdle) {
                    const active = n.batch.filter(b => this._isCurrentRunning(b.status));
                    if (active.length > 0) {
                        node.batch = {
                            active: active.length,
                            total: n.batch.length
                        };
                        calc.activeNodes.push(node);
                    }
                }
            }
        });
        return calc;
    }

    getNodeByTaskID(taskId) {
        const nodes = this._getNodesAsFlat();
        return nodes.find(n => n.taskId === taskId);
    }
}

module.exports = NodesMap;
