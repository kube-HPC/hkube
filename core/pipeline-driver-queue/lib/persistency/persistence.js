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
        await this.watchJobState();
        this.client.jobs.state.on('change', (data) => {
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
        return this.client.jobs.state.delete(options);
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

    watchJobState(options) {
        return this.client.jobs.state.watch(options);
    }

    getJobState(options) {
        return this.client.jobs.state.get(options);
    }
}

module.exports = new Persistence();
