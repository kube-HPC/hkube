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

    async getStoredPipelines({ pipelinesNames }) {
        const pipelines = await this.client.pipelines.list();
        return pipelines.filter(p => pipelinesNames.includes(p.name));
    }

    getActiveJobs() {
        return this.client.jobs.active.list({ limit: Number.MAX_SAFE_INTEGER });
    }

    store(data) {
        return this.client.pipelineDrivers.queue.set({ name: this.queueName, data: data.map(d => d.score) });
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
