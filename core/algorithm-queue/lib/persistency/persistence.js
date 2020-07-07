const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const redisStorage = require('./redis-storage-adapter');
const components = require('../consts/component-name');
const producerSingleton = require('../jobs/producer-singleton');

class Persistence {
    constructor() {
        this.queue = null;
        this.queueName = null;
        this.etcdConfig = null;
    }

    async init({ options }) {
        const { etcd, algorithmType, serviceName } = options;
        this.options = options;
        this.queueName = algorithmType;
        await redisStorage.init(options.redis, this.queueName);
        this.etcd = new Etcd({ ...etcd, serviceName });
        return this;
    }

    async store(data) {
        log.debug('storing data to etcd storage', { component: components.ETCD_PERSISTENT });
        const bullQueue = producerSingleton.get.getQueueByJobType(this.options.algorithmType);
        const pendingAmount = await bullQueue.getWaitingCount();
        await redisStorage.put(data);
        const scoreArray = data.map(d => d.calculated.score);
        const status = await this.etcd.algorithms.queue.set({ name: this.queueName, data: scoreArray, pendingAmount, timestamp: Date.now() });
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
