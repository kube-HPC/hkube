const { Factory } = require('@hkube/redis-utils');
const pathLib = require('path');
const logger = require('@hkube/logger');
const components = require('../consts/componentNames');
const PREFIX_GRAPH_PATH = 'hkube:pipeline:graph';
let log;

class RedisAdapter {
    constructor() {
        this._client = null;
    }

    async init(options) {
        log = logger.GetLogFromContainer();
        this._client = Factory.getClient(options.redis);
        log.info('redis initiated', { component: components.REDIS_PERSISTENT });
    }

    updateGraph(options) {
        const path = pathLib.join('/', PREFIX_GRAPH_PATH, options.jobId);
        return this._set(path, options.data);
    }

    getGraph(options) {
        const path = pathLib.join('/', PREFIX_GRAPH_PATH, options.jobId);
        return this._get(path);
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
