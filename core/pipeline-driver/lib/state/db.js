const { MongoError } = require('mongodb/lib/core/error');
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

    _exitOnConnectionError(error) {
        if (error instanceof MongoError) {
            log.error('db unreachable');
            process.exit(1);
        }
        return error;
    }

    async updateResult(options) {
        try {
            return await this._db.jobs.updateResult(options);
        }
        catch (error) {
            throw this._exitOnConnectionError(error);
        }
    }

    async updateStatus(options, updateOnlyActive) {
        try {
            return await this._db.jobs.updateStatus(options, updateOnlyActive);
        }
        catch (error) {
            throw this._exitOnConnectionError(error);
        }
    }

    async fetchStatus(options) {
        try {
            return await this._db.jobs.fetchStatus(options);
        }
        catch (error) {
            throw this._exitOnConnectionError(error);
        }
    }

    async fetchPipeline(options) {
        try {
            return await this._db.jobs.fetchPipeline(options);
        }
        catch (error) {
            throw this._exitOnConnectionError(error);
        }
    }

    async updatePipeline(options) {
        try {
            return await this._db.jobs.updatePipeline(options);
        }
        catch (error) {
            if (error?.name === 'MongoServerSelectionError') {
                log.error('db unreachable');
                process.exit(1);
            }
            throw error;
        }
    }

    async createJob({ jobId, pipeline, status }) {
        try {
            await this._db.jobs.create({ jobId, pipeline, status });
        }
        catch (error) {
            throw this._exitOnConnectionError(error);
        }
    }
}

module.exports = new DB();
