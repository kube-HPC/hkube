const dbConnect = require('@hkube/db');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').STATE_MANAGER;

class DB {
    async init(options) {
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    updateResult(options) {
        return this._db.jobs.updateResult(options);
    }

    updateStatus(options) {
        return this._db.jobs.updateStatus(options);
    }

    fetchStatus(options) {
        return this._db.jobs.fetchStatus(options);
    }

    fetchPipeline(options) {
        return this._db.jobs.fetchPipeline(options);
    }

    updatePipeline(options) {
        return this._db.jobs.updatePipeline(options);
    }

    async createJob({ jobId, pipeline, status }) {
        await this._db.jobs.create({ jobId, pipeline, status });
    }
}

module.exports = new DB();
