const Etcd = require('@hkube/etcd');
const { JobStatus } = require('@hkube/etcd');
const producerSingleton = require('../jobs/producer-singleton');

class Persistence {
    constructor() {
        this.queueName = null;
        this.etcd = new Etcd();
    }

    init({ options }) {
        const { etcd, producer, serviceName } = options;
        this.queueName = producer.jobType;
        this.etcd.init({ etcd, serviceName });
        return this;
    }

    async store(data) {
        // log.debug('storing data to etcd storage', { component: components.ETCD_PERSISTENT });
        const bullQueue = producerSingleton.get.getQueueByJobType(this.queueName);
        const pendingAmount = await bullQueue.getWaitingCount();
        await this.etcd.pipelineDrivers.queue.set({ queueName: this.queueName, data, pendingAmount });
        // log.debug('queue stored successfully', { component: components.ETCD_PERSISTENT });
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

    setJobStatus(options) {
        return this._etcd.jobStatus.set({ jobId: options.jobId, data: new JobStatus(options) });
    }
}


module.exports = new Persistence();
