
const RedisStorage = require('./redis-storage-adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const INTERVAL = 4000;

class GraphStore {
    constructor() {
        this._nodesMap = null;
        this._currentJobID = null;
        this._started = false;
        this._filterData = this.filterData.bind(this);
    }

    async init(options) {
        this.options = options;
    }

    start(jobId, nodeMap) {
        this._currentJobID = jobId;
        this._nodesMap = nodeMap;
        RedisStorage.setJobId(jobId);
        this.store();
    }

    stop() {
        this._currentJobID = null;
        this._nodesMap = null;
    }

    store() {
        setTimeout(async () => {
            try {
                if (this._nodesMap) {
                    await this._store();
                }
            }
            catch (error) {
                log.error(error, { component: components.GRAPH_STORE });
            }
            finally {
                if (this._nodesMap) {
                    this.store();
                }
            }
        }, INTERVAL);
    }

    _store() {
        if (!this.nodesMap) {
            throw new Error('nodeMap not referenced');
        }
        const graph = this.nodesMap.getJSONGraph(this._filterData);
        return RedisStorage.put(graph);
    }

    filterData(graph) {
        return graph;
    }
}

module.exports = new GraphStore();
