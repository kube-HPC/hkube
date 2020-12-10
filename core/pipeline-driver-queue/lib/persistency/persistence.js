const EventEmitter = require('events');
const Client = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const component = require('../consts/component-name').DB;

class Persistence extends EventEmitter {
    constructor() {
        super();
        this.queueName = null;
    }

    async init({ options }) {
        const log = Logger.GetLogFromContainer();
        const { etcd, persistence, serviceName } = options;
        this.queueName = persistence.type;
        this.client = new Client({ ...etcd, serviceName });
        await this.watchJobStatus();
        this.client.jobs.status.on('change', (data) => {
            this.emit(`job-${data.status}`, data);
        });
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
        return this;
    }

    store(data) {
        return this.client.pipelineDrivers.queue.set({ name: this.queueName, data });
    }

    get() {
        return this.client.pipelineDrivers.queue.get({ name: this.queueName });
    }

    async getExecution(options) {
        return this._db.jobs.fetchPipeline(options);
    }

    async setJobStatus(options) {
        await this.client.jobs.status.set(options);
        await this._db.jobs.updateStatus(options);
    }

    async setJobResults(options) {
        await this.client.jobs.results.set(options);
        await this._db.jobs.updateResult(options);
    }

    watchJobStatus(options) {
        return this.client.jobs.status.watch(options);
    }

    getJobStatus(options) {
        return this.client.jobs.status.get(options);
    }
}

module.exports = new Persistence();
