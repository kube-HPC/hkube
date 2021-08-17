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
        this._printThrottleMessages = {
            warning: { delay: 60000, lastPrint: null },
            info: { delay: 60000, lastPrint: null },
            error: { delay: 60000, lastPrint: null }
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
        const info = `${size} (${arrLength})`;
        // the old throttle was meaningless, the size is changing....
        if (this._maxPersistencySize && size > this._maxPersistencySize) {
            this._printThrottle('warning', `persistency with size ${info} is larger than ${this._maxPersistencySize}`);
            return;
        }
        try {
            // warning: this methods are not atomic!
            await this._delete({ path });
            await this._clientAsync.rpush(path, jsonArray);
            this._printThrottle('info', `persistency with size ${info} successfully saved`);
        }
        catch (e) {
            this._printThrottle('error', `persistency with size ${info} failed to save, ${e.message}`);
        }
    }

    _printThrottle(topic, message) {
        const setting = this._printThrottleMessages[topic];
        let shouldPrint = true;
        if (setting) {
            const { delay, lastPrint } = setting;
            if (lastPrint === null || Date.now() - lastPrint > delay) {
                shouldPrint = true;
                setting.lastPrint = Date.now();
            }
            else {
                shouldPrint = false;
            }
        }
        if (shouldPrint) {
            log[topic](message, { component });
        }
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
