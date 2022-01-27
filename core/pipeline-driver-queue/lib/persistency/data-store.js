const EventEmitter = require('events');
const Client = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const { pipelineTypes, pipelineStatuses } = require('@hkube/consts');
const component = require('../consts/component-name').DB;

class DataStore extends EventEmitter {
    async init(options) {
        const log = Logger.GetLogFromContainer();
        const { etcd, serviceName } = options;
        this._etcd = new Client({ ...etcd, serviceName });
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        await this._watchJobStatus();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    getJob({ jobId }) {
        return this._db.jobs.fetch({ jobId, fields: { status: true, pipeline: true } });
    }

    createJob({ jobId, pipeline, status }) {
        return this._db.jobs.create({ jobId, pipeline, status });
    }

    getJobs({ status }) {
        return this._db.jobs.search({
            pipelineStatus: status,
            sort: { 'pipeline.startTime': 'asc' },
            fields: { jobId: true, pipeline: true, next: true }
        });
    }

    getConcurrentActiveJobs() {
        return this._db.jobs.search({
            pipelineType: pipelineTypes.STORED,
            pipelineStatus: pipelineStatuses.ACTIVE,
            isConcurrencyReject: false,
            hasResult: false,
            fields: {
                name: 'pipeline.name',
            }
        });
    }

    storeQueue(options) {
        return this._etcd.pipelineDrivers.queue.set(options);
    }

    async _watchJobStatus() {
        await this._db.jobs.watchStatus({}, (job) => {
            this.emit(`job-${job.status}`, job);
        });
    }

    setJobStatus(options) {
        return this._db.jobs.updateStatus(options);
    }

    async setJobNext(jobId, next) {
        return this._db.jobs.updateNext(jobId, next);
    }

    setJobResults(options) {
        return this._db.jobs.updateResult(options);
    }
}

module.exports = new DataStore();
