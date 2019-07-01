
const clone = require('clone');
const deep = require('deep-get-set');
const flatten = require('flat');
const logger = require('@hkube/logger');
const States = require('../state/NodeStates');
const RedisStorage = require('./redis-storage-adapter');
const { groupTypes } = require('../consts/graph-storage-types');
const components = require('../consts/componentNames');

const { EDGE } = groupTypes;
const INTERVAL = 4000;
let log;

class GraphStore {
    constructor() {
        this._interval = null;
        this._nodesMap = null;
        this._currentJobID = null;
    }

    init() {
        log = logger.GetLogFromContainer();
    }

    async start(jobId, nodeMap) {
        this._currentJobID = jobId;
        this._nodesMap = nodeMap;
        await this._store();
        this._storeInterval();
    }

    async stop() {
        await this._updateGraph();
        clearInterval(this._interval);
        this._interval = null;
        this._nodesMap = null;
        this._currentJobID = null;
    }

    getGraph(options) {
        return RedisStorage.getNodesGraph({ jobId: options.jobId });
    }

    deleteGraph(options) {
        return RedisStorage.deleteDriverGraph({ jobId: options.jobId });
    }

    _storeInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(() => {
            if (this._working) {
                return;
            }
            this._working = true;
            this._store();
            this._working = false;
        }, INTERVAL);
    }

    async _store() {
        try {
            if (this._nodesMap) {
                const graph = this._nodesMap.getJSONGraph();
                await Promise.all([
                    this._updateGraph(graph),
                    this._updateDriverGraph(graph)
                ]);
            }
        }
        catch (error) {
            log.error(error, { component: components.GRAPH_STORE });
        }
    }

    async _updateGraph(graph) {
        const g = (graph) || (this._nodesMap && this._nodesMap.getJSONGraph());
        if (g) {
            const filterGraph = this._filterData(g);
            await RedisStorage.updateGraph({ jobId: this._currentJobID, data: filterGraph });
        }
    }

    async _updateDriverGraph(graph) {
        await RedisStorage.updateDriverGraph({ jobId: this._currentJobID, data: graph });
    }

    _formatEdge(e) {
        const { type } = e.value[0];
        const edge = {
            from: e.v,
            to: e.w,
            group: EDGE.NONE
        };
        if (type === EDGE.WAIT_ANY) {
            edge.group = EDGE.WAIT_ANY;
        }
        else if (type === EDGE.ALGORITHM_EXECUTION) {
            edge.group = EDGE.ALGORITHM_EXECUTION;
        }
        return edge;
    }

    _filterData(graph) {
        const adaptedGraph = {
            jobId: this._currentJobID,
            graph: {
                edges: [],
                nodes: [],
            }
        };
        adaptedGraph.graph.edges = graph.edges.map(e => this._formatEdge(e));
        adaptedGraph.graph.nodes = graph.nodes.map(n => this._handleNode(n.value));
        return adaptedGraph;
    }

    _handleNode(node) {
        if (node.batch.length === 0) {
            return this._handleSingle(node);
        }
        return this._handleBatch(node);
    }

    _handleSingle(node) {
        const { SINGLE } = groupTypes;
        const calculatedNode = {
            taskId: node.taskId,
            input: this._parseInput(node),
            output: node.result,
            status: node.status,
            error: node.error,
            prevErrors: node.prevErrors,
            nodeName: node.nodeName,
            algorithmName: node.algorithmName,
            retries: node.retries,
            group: SINGLE.NOT_STARTED,
            startTime: node.startTime,
            endTime: node.endTime
        };
        calculatedNode.group = this._singleStatus(node.status);
        return calculatedNode;
    }

    _handleBatch(node) {
        const { BATCH } = groupTypes;
        const batchTasks = node.batch.map(b => ({
            taskId: b.taskId,
            batchIndex: b.batchIndex,
            input: this._parseInput(b),
            output: b.result,
            status: b.status,
            error: b.error,
            prevErrors: b.prevErrors,
            retries: b.retries,
            startTime: b.startTime,
            endTime: b.endTime
        }));
        const calculatedNode = {
            nodeName: node.nodeName,
            algorithmName: node.algorithmName,
            extra: {},
            group: BATCH.NOT_STARTED,
            batchTasks
        };
        let completed = 0;
        let group = null;
        const batchStatus = this._batchStatusCounter(node);
        if (batchStatus.completed === node.batch.length) {
            completed = node.batch.length;
            group = BATCH.COMPLETED;
        }
        else if (batchStatus.idle === node.batch.length) {
            completed = 0;
            group = BATCH.NOT_STARTED;
        }
        else {
            completed = batchStatus.running + batchStatus.completed;
            group = BATCH.RUNNING;
        }
        if (batchStatus.errors > 0) {
            group = BATCH.ERRORS;
        }
        calculatedNode.extra.batch = `${completed}/${node.batch.length}`;
        calculatedNode.group = group;
        return calculatedNode;
    }

    _parseInput(node) {
        if (!node.input) {
            return null;
        }
        const result = clone(node.input);
        const flatObj = flatten(node.input);

        Object.entries(flatObj).forEach(([objectPath, value]) => {
            if (typeof value === 'string' && value.startsWith('$$')) {
                const key = value.substring(2);
                const link = node.storage[key];
                deep(result, objectPath, link.storageInfo);
            }
        });
        return result;
    }

    _batchStatusCounter(node) {
        const batchState = {
            idle: 0,
            completed: 0,
            errors: 0,
            running: 0
        };

        node.batch.forEach((b) => {
            const { STATUS } = groupTypes;
            const status = this._singleStatus(b.status);
            if (b.error) {
                batchState.errors += 1;
            }
            if (status === STATUS.COMPLETED) {
                batchState.completed += 1;
            }
            else if (status === STATUS.NOT_STARTED) {
                batchState.idle += 1;
            }
            else {
                batchState.running += 1;
            }
        });
        return batchState;
    }

    _singleStatus(s) {
        const { STATUS } = groupTypes;
        if (s === States.SKIPPED) {
            return States.SKIPPED;
        }
        if (s === States.SUCCEED || s === States.FAILED) {
            return STATUS.COMPLETED;
        }
        if (s === States.CREATING || s === States.PENDING) {
            return STATUS.NOT_STARTED;
        }
        return STATUS.RUNNING;
    }
}

module.exports = new GraphStore();
