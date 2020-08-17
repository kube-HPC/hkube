const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const redisStorage = require('./redis-storage-adapter');
const components = require('../consts/component-name');
const producerSingleton = require('../jobs/producer-singleton');

class Persistence {
    constructor() {
        this._queueName = null;
        this._prevDataLength = null;
        this._prevPendingAmount = null;
        this._maxPersistencySize = 1e6;
    }

    async init({ options }) {
        const { etcd, algorithmType, serviceName } = options;
        this._queueName = algorithmType;
        await redisStorage.init(options.redis, this._queueName);
        this._maxPersistencySize = options.queue.maxPersistencySize;
        this._etcd = new Etcd({ ...etcd, serviceName });
        return this;
    }

    async store(data) {
        log.debug('storing data to persistency storage', { component: components.ETCD_PERSISTENT });
        const pendingAmount = await producerSingleton.queue.getWaitingCount();
        if (this._prevDataLength === 0 && data.length === 0 && this._prevPendingAmount === pendingAmount) {
            return;
        }
        log.info(`writing ${data.length} items to persistency`, { component: components.ETCD_PERSISTENT });
        this._prevDataLength = data.length;
        this._prevPendingAmount = pendingAmount;
        try {
            const jsonData = data.map(d => JSON.stringify(d)).join('\n');
            if (this._maxPersistencySize && jsonData.length > this._maxPersistencySize) {
                log.warning(`persistency length is ${jsonData.length} which is larger than ${this._maxPersistencySize}`, { component: components.ETCD_PERSISTENT });
                return;
            }
            log.info(`writing ${jsonData.length} bytes to persistency`, { component: components.ETCD_PERSISTENT });

            await redisStorage.put(jsonData);
        }
        catch (error) {
            log.error(`failed to store persistency ${error.message}`, { component: components.ETCD_PERSISTENT }, error);
        }

        log.info(`finished writing ${data.length} items to persistency`, { component: components.ETCD_PERSISTENT });
        const scoreArray = data.map(d => d.calculated.score);
        const status = await this._etcd.algorithms.queue.set({ name: this._queueName, data: scoreArray, pendingAmount, timestamp: Date.now() });
        if (status) {
            log.debug('queue stored successfully', { component: components.ETCD_PERSISTENT });
        }
    }

    async get() {
        try {
            const ret = await redisStorage.get();
            const data = ret.split('\n').map(d => JSON.parse(d));
            return data;
        }
        catch (error) {
            log.warning('failed to get queue persistency', { component: components.ETCD_PERSISTENT }, error);
            return [];
        }
    }

    _delete() {
        return redisStorage._delete();
    }
}

module.exports = new Persistence();
