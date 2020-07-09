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
    }

    async init({ options }) {
        const { etcd, algorithmType, serviceName } = options;
        this._queueName = algorithmType;
        await redisStorage.init(options.redis, this._queueName);
        this._etcd = new Etcd({ ...etcd, serviceName });
        return this;
    }

    async store(data) {
        log.debug('storing data to etcd storage', { component: components.ETCD_PERSISTENT });

        const pendingAmount = await producerSingleton.queue.getWaitingCount();

        if (this._prevDataLength === 0 && data.length === 0 && this._prevPendingAmount === pendingAmount) {
            return;
        }
        this._prevDataLength = data.length;
        this._prevPendingAmount = pendingAmount;
        await redisStorage.put(data);
        const scoreArray = data.map(d => d.calculated.score);
        const status = await this._etcd.algorithms.queue.set({ name: this._queueName, data: scoreArray, pendingAmount, timestamp: Date.now() });
        if (status) {
            log.debug('queue stored successfully', { component: components.ETCD_PERSISTENT });
        }
    }

    get() {
        return redisStorage.get();
    }

    _delete() {
        return redisStorage._delete();
    }
}

module.exports = new Persistence();
