
const States = require('../state/NodeStates');
const RedisStorage = require('./redis-storage-adapter');
const { groupTypes } = require('../consts/graph-storage-types');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const INTERVAL = 4000;

class GraphStore {
    constructor() {
        this._interval = null;
        this._nodesMap = null;
        this._currentJobID = null;
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
        return RedisStorage.deleteNodesGraph({ jobId: options.jobId });
    }

    async _storeInterval() {
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
            if (!this._nodesMap) {
                throw new Error('nodeMap not referenced');
            }
            const graph = this._nodesMap.getJSONGraph();
            await Promise.all([
                this._updateGraph(graph),
                this._updateNodesGraph(graph)
            ]);
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

    async _updateNodesGraph(graph) {
        await RedisStorage.updateNodesGraph({ jobId: this._currentJobID, data: graph });
    }

    _filterData(graph) {
        const { EDGE } = groupTypes;
        const adaptedGraph = {
            jobId: this._currentJobID,
            graph: {
                edges: [],
                nodes: [],
            }
        };
        adaptedGraph.graph.edges = graph.edges.map(e => ({ from: e.v, to: e.w, group: e.value[0].type === EDGE.WAIT_ANY ? EDGE.WAIT_ANY : EDGE.NONE }));
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
        const calculatedNode = { id: node.nodeName, label: node.nodeName, extra: {}, group: SINGLE.NOT_STARTED };
        calculatedNode.group = this._singleStatus(node.status);
        return calculatedNode;
    }

    _handleBatch(node) {
        const { BATCH } = groupTypes;
        const calculatedNode = { id: node.nodeName, label: node.nodeName, extra: {}, group: BATCH.NOT_STARTED };
        const batchStatus = this._batchStatusCounter(node);
        if (batchStatus.completed === node.batch.length) {
            calculatedNode.extra.batch = `${node.batch.length}/${node.batch.length}`;
            calculatedNode.group = BATCH.COMPLETED;
        }
        else if (batchStatus.idle === node.batch.length) {
            calculatedNode.extra.batch = `0/${node.batch.length}`;
            calculatedNode.group = BATCH.NOT_STARTED;
        }
        else {
            calculatedNode.extra.batch = `${batchStatus.running + batchStatus.completed}/${node.batch.length}`;
            calculatedNode.group = BATCH.RUNNING;
        }
        return calculatedNode;
    }

    _batchStatusCounter(node) {
        const batchState = {
            idle: 0,
            completed: 0,
            running: 0,
        };

        node.batch.forEach((b) => {
            const { STATUS } = groupTypes;
            const status = this._singleStatus(b.status);
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
        if (s === States.SUCCEED || s === States.FAILED) {
            return STATUS.COMPLETED;
        }
        else if (s === States.CREATING || s === States.PENDING) {
            return STATUS.NOT_STARTED;
        }
        return STATUS.RUNNING;
    }
}

module.exports = new GraphStore();
