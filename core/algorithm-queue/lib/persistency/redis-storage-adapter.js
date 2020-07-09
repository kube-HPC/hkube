const { Factory } = require('@hkube/redis-utils');
const pathLib = require('path');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../consts/component-name');

let client;

class RedisAdapter {
    constructor() {
        this._isInit = false;
        this.queueName = '';
    }

    async init(options, queueName) {
        if (!this._isInit) {
            client = Factory.getClient(options);
            this._isInit = true;
            log.info('redis initiated', { component: components.REDIS_PERSISTENT });
        }
        this.queueName = queueName;
        this.path = pathLib.join('/', 'algorithmQueue', this.queueName);
    }

    async put(options) {
        return this._set(options);
    }

    _set(data) {
        return new Promise((resolve, reject) => {
            client.set(this.path, JSON.stringify(data), (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve(true);
            });
        });
    }

    async get() {
        return this._get();
    }

    _get() {
        return new Promise((resolve, reject) => {
            client.get(this.path, (err, res) => {
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

    _delete() {
        return new Promise((resolve, reject) => {
            client.del(this.path, (err) => {
                if (err) {
                    return reject(err);
                }
                return resolve();
            });
        });
    }
}

module.exports = new RedisAdapter();
