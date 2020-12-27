const clone = require('clone');
const isEqual = require('lodash.isequal');
const objectPath = require('object-path');
const flatten = require('flat');
const logger = require('@hkube/logger');
const { Persistency } = require('@hkube/dag');
const { taskStatuses } = require('@hkube/consts');
const components = require('../consts/componentNames');
const INTERVAL = 4000;
let log;

class GraphStore {
    constructor() {
        this._interval = null;
        this._nodesMap = null;
        this._currentJobID = null;
    }

    init(options) {
        log = logger.GetLogFromContainer();
        this._persistency = new Persistency({ connection: options.redis });
    }

    async start(jobId, nodeMap) {
        this._currentJobID = jobId;
        this._nodesMap = nodeMap;
        await this._store();
        this._storeInterval();
    }

    async stop() {
        await this._store();
        clearInterval(this._interval);
        this._interval = null;
        this._nodesMap = null;
        this._currentJobID = null;
    }

    async getGraph(options) {
        const jsonGraph = await this._persistency.getGraph({ jobId: options.jobId });
        const graph = this._tryParseJSON(jsonGraph);
        return graph;
    }

    _tryParseJSON(json) {
        let parsed;
        try {
            parsed = JSON.parse(json);
        }
        catch (e) {
            log.warning('failed to parse json graph', { component: components.GRAPH_STORE });
        }
        return parsed;
    }

    _storeInterval() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(async () => {
            if (this._working) {
                return;
            }
            this._working = true;
            await this._store();
            this._working = false;
        }, INTERVAL);
    }

    async _store() {
        try {
            if (this._nodesMap) {
                const graph = this._nodesMap.getJSONGraph();
                await this._updateGraph(graph);
            }
        }
        catch (error) {
            log.error(error.message, { component: components.GRAPH_STORE }, error);
        }
    }

    async _updateGraph(graph) {
        const filterGraph = this._filterData(graph);
        if (!isEqual(this._lastGraph, filterGraph)) {
            this._lastGraph = filterGraph;
            await this._persistency.setGraph({ jobId: this._currentJobID, data: { jobId: this._currentJobID, timestamp: Date.now(), ...filterGraph } });
        }
    }

    _formatEdge(e) {
        const edge = {
            from: e.v,
            to: e.w,
            value: e.value
        };
        return edge;
    }

    _filterData(graph) {
        return {
            edges: graph.edges.map(e => this._formatEdge(e)),
            nodes: graph.nodes.map(n => this._formatNode(n.value))
        };
    }

    _formatNode(node) {
        if (node.batch.length === 0) {
            return this._handleSingle(node);
        }
        return this._handleBatch(node);
    }

    _mapTask(task) {
        return {
            taskId: task.taskId,
            input: this._parseInput(task),
            output: task.result,
            podName: task.podName,
            status: task.status,
            error: task.error,
            warnings: task.warnings,
            retries: task.retries,
            batchIndex: task.batchIndex,
            startTime: task.startTime,
            endTime: task.endTime,
            metricsPath: task.metricsPath,
            level: task.level
        };
    }

    _handleSingle(n) {
        const node = {
            nodeName: n.nodeName,
            algorithmName: n.algorithmName,
            ...this._mapTask(n)
        };
        return node;
    }

    _handleBatch(n) {
        const node = {
            nodeName: n.nodeName,
            algorithmName: n.algorithmName,
            batch: n.batch.map(b => this._mapTask(b)),
            batchInfo: this._batchInfo(n.batch),
            level: n.level
        };
        return node;
    }

    _parseInput(node) {
        if (!node.input) {
            return null;
        }
        const result = clone(node.input);
        const flatObj = flatten(node.input);

        Object.entries(flatObj).forEach(([k, v]) => {
            if (typeof v === 'string' && v.startsWith('$$')) {
                const key = v.substring(2);
                const storage = node.storage[key];
                let input;
                if (Array.isArray(storage)) {
                    input = { type: 'array', size: storage.length };
                }
                else {
                    input = storage?.storageInfo;
                }
                objectPath.set(result, k, input);
            }
        });
        return result;
    }

    _batchInfo(batch) {
        const batchInfo = {
            idle: 0,
            completed: 0,
            errors: 0,
            running: 0,
            total: batch.length
        };
        batch.forEach((b) => {
            if (b.error) {
                batchInfo.errors += 1;
            }
            if (b.status === taskStatuses.SUCCEED || b.status === taskStatuses.FAILED) {
                batchInfo.completed += 1;
            }
            else if (b.status === taskStatuses.CREATING || b.status === taskStatuses.PENDING) {
                batchInfo.idle += 1;
            }
            else {
                batchInfo.running += 1;
            }
        });
        return batchInfo;
    }
}

module.exports = new GraphStore();
