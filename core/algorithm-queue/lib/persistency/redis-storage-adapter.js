const { Factory } = require('@hkube/redis-utils');
const { promisify } = require('util');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/component-name').REDIS_PERSISTENT;

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
        log.info(`persistency initialized with max size of ${this._maxPersistencySize}`, { component });
    }

    async put({ data, path }) {
        if (!data || data.length === 0) {
            return;
        }
        const jsonArray = data.map(JSON.stringify);
        const size = jsonArray.reduce((prev, cur) => prev + cur.length, 0);
        const arrLength = data.length;
        if (this._maxPersistencySize && size > this._maxPersistencySize) {
            log.throttle.warning(`persistency size is ${size} (${arrLength}) which is larger than ${this._maxPersistencySize}`, { component });
            return;
        }
        await this._delete({ path });
        await this._clientAsync.rpush(path, jsonArray);
        log.throttle.info(`persistency with size ${size} (${arrLength}) successfully saved`, { component });
    }

    async get({ path }) {
        const dataJson = await this._clientAsync.lrange(path, 0, -1);
        const data = dataJson.map(d => JSON.parse(d));
        return data;
    }

    _delete({ path }) {
        return this._clientAsync.del(path);
    }
}

module.exports = new RedisAdapter();
