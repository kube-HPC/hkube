const dbConnect = require('@hkube/db');
const logger = require('@hkube/logger');
const component = require('../consts/componentNames').STATE_MANAGER;
let log;

class DB {
    async init(options) {
        log = logger.GetLogFromContainer();
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

    patchPipeline(options, cb) {
        return this._db.jobs.patchPipeline(options, cb);
    }
}

module.exports = new DB();
