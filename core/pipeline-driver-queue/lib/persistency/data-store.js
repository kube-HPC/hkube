const EventEmitter = require('events');
const Client = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const component = require('../consts/component-name').DB;

class DataStore extends EventEmitter {
    async init(options) {
        const log = Logger.GetLogFromContainer();
        const { etcd, serviceName } = options;
        this._etcd = new Client({ ...etcd, serviceName });
        await this._watchJobStatus();
        this._etcd.jobs.status.on('change', (data) => {
            this.emit(`job-${data.status}`, data);
        });
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    async storeQueue(options) {
        return this._etcd.pipelineDrivers.queue.set(options);
    }

    async _watchJobStatus(options) {
        await this._etcd.jobs.status.watch(options);
    }

    async getJob({ jobId }) {
        return this._db.jobs.fetch({ jobId, fields: { status: true, pipeline: true } });
    }

    async setJobStatus(options) {
        await this._etcd.jobs.status.update(options);
        await this._db.jobs.updateStatus(options);
    }

    async setJobResults(options) {
        await this._etcd.jobs.results.set(options);
        await this._db.jobs.updateResult(options);
    }

    async getStoredPipelines({ pipelinesNames }) {
        const pipelines = await this._db.pipelines.fetchAll();
        return pipelines.filter(p => pipelinesNames.includes(p.name));
    }
}

module.exports = new DataStore();
