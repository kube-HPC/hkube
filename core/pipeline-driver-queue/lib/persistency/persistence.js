const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const { JobStatus, JobResult } = require('@hkube/etcd');

class Persistence extends EventEmitter {
    constructor() {
        super();
        this.queueName = null;
        this.etcd = new Etcd();
    }

    async init({ options }) {
        const { etcd, persistence, serviceName } = options;
        this.queueName = persistence.type;
        this.etcd.init({ etcd, serviceName });
        await this.watchJobState();
        this.etcd.jobState.on('change', (data) => {
            this.emit(`job-${data.state}`, data);
        });
        return this;
    }

    store(data) {
        return this.etcd.pipelineDrivers.queue.set({ name: this.queueName, ...data });
    }

    get() {
        return this.etcd.pipelineDrivers.queue.get({ name: this.queueName });
    }

    deleteTasksState(options) {
        return this.etcd.jobState.delete(options);
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

    setJobResults(options) {
        return this.etcd.jobResults.set({ jobId: options.jobId, data: new JobResult(options) });
    }

    watchJobState(options) {
        return this.etcd.jobState.watch(options);
    }

    getJobState(options) {
        return this.etcd.jobState.getState(options);
    }
}


module.exports = new Persistence();
