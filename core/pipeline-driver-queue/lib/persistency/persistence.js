const EventEmitter = require('events');
const Client = require('@hkube/etcd');

class Persistence extends EventEmitter {
    constructor() {
        super();
        this.queueName = null;
    }

    async init({ options }) {
        const { etcd, persistence, serviceName } = options;
        this.queueName = persistence.type;
        this.client = new Client({ ...etcd, serviceName });
        await this.watchJobStatus();
        this.client.jobs.status.on('change', (data) => {
            this.emit(`job-${data.status}`, data);
        });
        return this;
    }

    store(data) {
        return this.client.pipelineDrivers.queue.set({ name: this.queueName, data });
    }

    get() {
        return this.client.pipelineDrivers.queue.get({ name: this.queueName });
    }

    getExecution(options) {
        return this.client.executions.stored.get(options);
    }

    setJobStatus(options) {
        return this.client.jobs.status.set(options);
    }

    setJobResults(options) {
        return this.client.jobs.results.set(options);
    }

    watchJobStatus(options) {
        return this.client.jobs.status.watch(options);
    }

    getJobStatus(options) {
        return this.client.jobs.status.get(options);
    }
}

module.exports = new Persistence();
