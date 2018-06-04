
const log = require('@hkube/logger').GetLogFromContainer();
const Etcd = require('@hkube/etcd');
const components = require('../consts/component-name');
const producerSingleton = require('../jobs/producer-singleton');

class Persistence {
    constructor() {
        this.queueName = null;
        this.etcd = new Etcd();
    }

    init({ options }) {
        this.options = options;
        const { etcd, consumer, serviceName } = options;
        this.queueName = consumer.jobType;
        this.etcd.init({ etcd, serviceName });
        return this;
    }

    async store(data) {
        log.debug('storing data to etcd storage', { component: components.ETCD_PERSISTENT });
        const bullQueue = producerSingleton.get.getQueueByJobType(this.queueName);
        const pendingAmount = await bullQueue.getWaitingCount();
        const status = await this.etcd.pipelineDrivers.queue.set({ queueName: this.queueName, data, pendingAmount });
        if (status) {
            log.debug('queue stored successfully', { component: components.ETCD_PERSISTENT });
        }
    }

    get() {
        return this.etcd.pipelineDrivers.queue.get({ queueName: this.queueName });
    }

    getExecution(options) {
        return this.etcd.execution.get(options);
    }

    setExecution(options) {
        return this.etcd.execution.set(options);
    }
}


module.exports = new Persistence();
