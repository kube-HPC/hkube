/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const { Factory } = require('@hkube/redis-utils');
const { promisify } = require('util');
const pathLib = require('path');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../consts/component-name');

class RedisAdapter {
    constructor() {
        this._isInit = false;
        this.queueName = '';
        this._maxPersistencySize = 1e6;
    }

    async init(options, queueName, maxPersistencySize = 1e7) {
        if (!this._isInit) {
            const client = Factory.getClient(options);
            this._clientAsync = {
                get: promisify(client.get).bind(client),
                set: promisify(client.set).bind(client),
                del: promisify(client.del).bind(client),
                rpush: promisify(client.rpush).bind(client),
                lrange: promisify(client.lrange).bind(client),

            };
            this._isInit = true;
            this._maxPersistencySize = maxPersistencySize;
            log.info('redis initiated', { component: components.REDIS_PERSISTENT });
        }
        this.queueName = queueName;
        this.path = pathLib.join('/', 'algorithmQueue', this.queueName);
    }

    async put(options) {
        return this._set(options);
    }

    async _set(data) {
        await this._delete();
        if (!data || data.length === 0) {
            return;
        }
        const jsonArray = data.map(JSON.stringify);
        const size = jsonArray.reduce((prev, cur) => prev + cur.length, 0);
        if (this._maxPersistencySize && size > this._maxPersistencySize) {
            log.throttle.warning(`persistency length is ${size} which is larger than ${this._maxPersistencySize}`, { component: components.ETCD_PERSISTENT });
            return;
        }
        await this._clientAsync.rpush(this.path, jsonArray);
        log.debug(`wrote ${size} bytes to persistency`, { component: components.ETCD_PERSISTENT });
    }

    async get() {
        return this._get();
    }

    async _get() {
        const dataJson = await this._clientAsync.lrange(this.path, 0, -1);
        const data = dataJson.map(d => JSON.parse(d));
        return data;
    }

    _delete() {
        return this._clientAsync.del(this.path);
    }
}

module.exports = new RedisAdapter();
