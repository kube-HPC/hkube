const { Factory } = require('@hkube/redis-utils');
const { promisify } = require('util');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../consts/component-name');

class RedisAdapter {
    async init(options) {
        const client = Factory.getClient(options.redis);
        this._clientAsync = {
            get: promisify(client.get).bind(client),
            set: promisify(client.set).bind(client),
            del: promisify(client.del).bind(client),
            rpush: promisify(client.rpush).bind(client),
            lrange: promisify(client.lrange).bind(client),
        };
        this._maxPersistencySize = options.queue.maxPersistencySize;
        log.info('redis initiated', { component: components.REDIS_PERSISTENT });
    }

    async put({ data, path }) {
        return this._set({ data, path });
    }

    async _set({ data, path }) {
        await this._delete({ path });
        if (!data || data.length === 0) {
            return;
        }
        const jsonArray = data.map(JSON.stringify);
        const size = jsonArray.reduce((prev, cur) => prev + cur.length, 0);
        if (this._maxPersistencySize && size > this._maxPersistencySize) {
            log.throttle.warning(`persistency length is ${size} which is larger than ${this._maxPersistencySize}`, { component: components.ETCD_PERSISTENT });
            return;
        }
        await this._clientAsync.rpush(path, jsonArray);
        log.debug(`wrote ${size} bytes to persistency`, { component: components.ETCD_PERSISTENT });
    }

    async get({ path }) {
        return this._get({ path });
    }

    async _get({ path }) {
        const dataJson = await this._clientAsync.lrange(path, 0, -1);
        const data = dataJson.map(d => JSON.parse(d));
        return data;
    }

    _delete({ path }) {
        return this._clientAsync.del(path);
    }
}

module.exports = new RedisAdapter();
