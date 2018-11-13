const { Factory } = require('@hkube/redis-utils');
const pathLib = require('path');
const logger = require('@hkube/logger');
const components = require('../consts/componentNames');
const PREFIX_GRAPH_PATH = 'pipeline-driver/graph';
const PREFIX_NODES_GRAPH_PATH = 'pipeline-driver/nodes-graph';
let log;

class RedisAdapter {
    constructor() {
        this._isInit = false;
        this._client = null;
    }

    async init(options) {
        log = logger.GetLogFromContainer();
        if (!this._isInit) {
            this._client = Factory.getClient(options.redis);
            this._isInit = true;
            log.info('redis initiated', { component: components.REDIS_PERSISTENT });
        }
    }

    updateGraph(options) {
        const path = pathLib.join('/', PREFIX_GRAPH_PATH, options.jobId);
        return this._set(path, options.data);
    }

    getNodesGraph(options) {
        const path = pathLib.join('/', PREFIX_NODES_GRAPH_PATH, options.jobId);
        return this._get(path);
    }

    updateNodesGraph(options) {
        const path = pathLib.join('/', PREFIX_NODES_GRAPH_PATH, options.jobId);
        return this._set(path, options.data);
    }

    deleteNodesGraph(options) {
        const path = pathLib.join('/', PREFIX_NODES_GRAPH_PATH, options.jobId);
        return this._del(path);
    }

    _set(path, options) {
        return new Promise((resolve, reject) => {
            this._client.set(path, JSON.stringify(options), (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve(true);
            });
        });
    }

    _get(path) {
        return new Promise((resolve, reject) => {
            this._client.get(path, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(this._tryParseJSON(res));
            });
        });
    }

    _del(path) {
        return new Promise((resolve, reject) => {
            this._client.del(path, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve(true);
            });
        });
    }

    _tryParseJSON(json) {
        let parsed = json;
        try {
            parsed = JSON.parse(json);
        }
        catch (e) {
            log.warn(`fail to parse json ${json} `, { component: components.REDIS_PERSISTENT });
        }
        return parsed;
    }
}

module.exports = new RedisAdapter();
