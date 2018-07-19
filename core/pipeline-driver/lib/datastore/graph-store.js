
const States = require('../state/NodeStates');
const RedisStorage = require('./redis-storage-adapter');
const { groupTypes } = require('../consts/graph-storage-types');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../../common/consts/componentNames');
class GraphStore {
    constructor() {
        this.nodesMap = null;
        this.INTERVAL = 4000;
        this.currentJobID = null;
        this.started = false;
        this._filterData = this.filterData.bind(this);
    }
    async init(options) {
        this.options = options;
    }

    start(jobId, nodeMap) {
        this.currentJobID = jobId;
        this.nodesMap = nodeMap;
        RedisStorage.setJobId(jobId);
        this.started = true;
        this.store();
    }
    stop() {
        this.started = false;
        this.currentJobID = null;
        this.nodesMap = null;
    }
    store() {
        setTimeout(async () => {
            try {
                if (this.started) {
                    await this._store();
                }
            }
            catch (error) {
                log.error(error, { component: components.GRAPH_STORE });
            }
            finally {
                if (this.started) {
                    this.store();
                }
            }
        }, this.INTERVAL);
    }
    _store() {
        return new Promise(async (resolve, reject) => { 
            try {
                if (!this.nodesMap) {
                    return reject(new Error('nodeMap not referenced'));
                }
                this.caluclatedGraph = this.nodesMap.getJSONGraph(this._filterData);
                await RedisStorage.put(this.caluclatedGraph);
                return resolve();
            }
            catch (error) {
                return reject(new Error(`faild on storing graph to redis error:${error}`));
            }
        });
    }
    filterData(graph) {
        const { EDGE } = groupTypes;
        const adaptedGraph = {
            jobId: this.currentJobID,
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
            calculatedNode.extra.batch = `${batchStatus.running}/${node.batch.length}`;
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
