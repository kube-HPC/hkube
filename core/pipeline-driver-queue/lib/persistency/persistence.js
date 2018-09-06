const EventEmitter = require('events');
const Client = require('@hkube/etcd');
const { JobStatus, JobResult } = require('@hkube/etcd');

class Persistence extends EventEmitter {
    constructor() {
        super();
        this.queueName = null;
        this.client = new Client();
    }

    async init({ options }) {
        const { etcd, persistence, serviceName } = options;
        this.queueName = persistence.type;
        this.client.init({ etcd, serviceName });
        await this.watchJobState();
        this.client.jobState.on('change', (data) => {
            this.emit(`job-${data.state}`, data);
        });
        return this;
    }

    store(data) {
        return this.client.pipelineDrivers.queue.set({ name: this.queueName, data });
    }

    get() {
        return this.client.pipelineDrivers.queue.get({ name: this.queueName });
    }

    deleteTasksState(options) {
        return this.client.jobState.delete(options);
    }

    getExecution(options) {
        return this.client.execution.get(options);
    }

    setJobStatus(options) {
        return this.client.jobStatus.set({ jobId: options.jobId, data: new JobStatus(options) });
    }

    setJobResults(options) {
        return this.client.jobResults.set({ jobId: options.jobId, data: new JobResult(options) });
    }

    watchJobState(options) {
        return this.client.jobState.watch(options);
    }

    getJobState(options) {
        return this.client.jobState.getState(options);
    }
}

module.exports = new Persistence();
