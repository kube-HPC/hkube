const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const { JobStatus } = require('@hkube/etcd');
const producerSingleton = require('../jobs/producer-singleton');

class Persistence extends EventEmitter {
    constructor() {
        super();
        this.queueName = null;
        this.etcd = new Etcd();
    }

    init({ options }) {
        const { etcd, producer, serviceName } = options;
        this.queueName = producer.jobType;
        this.etcd.init({ etcd, serviceName });
        this.etcd.jobs.on('change', (data) => {
            this.emit(`job-${data.state}`, data);
        });
        return this;
    }

    async store(data) {
        // log.debug('storing data to etcd storage', { component: components.ETCD_PERSISTENT });
        const bullQueue = producerSingleton.get.getQueueByJobType(this.queueName);
        const pendingAmount = await bullQueue.getWaitingCount();
        await this.etcd.pipelineDrivers.queue.set({ name: this.queueName, data, pendingAmount });
        // log.debug('queue stored successfully', { component: components.ETCD_PERSISTENT });
    }

    get() {
        return this.etcd.pipelineDrivers.queue.get({ name: this.queueName });
    }

    getExecution(options) {
        return this.etcd.execution.get(options);
    }

    setExecution(options) {
        return this.etcd.execution.set(options);
    }

    setJobStatus(options) {
        return this.etcd.jobStatus.set({ jobId: options.jobId, data: new JobStatus(options) });
    }

    watchJobState(options) {
        return this.etcd.jobs.watch(options);
    }

    unWatchJobState(options) {
        return this.etcd.jobs.unwatch(options);
    }
}


module.exports = new Persistence();
