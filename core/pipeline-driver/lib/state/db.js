const dbConnect = require('@hkube/db');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').STATE_MANAGER;

class DB {
    async init(options) {
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        this._wrapJobsService();
        this._exitOnDBProblemBinded = this._exitOnDBProblem.bind(this);
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    _exitOnDBProblem(error) {
        if (this._db.isFatal(error)) {
            log.error(`db unreachable + ${error}`, { component });
            process.exit(1);
        }
        return error;
    }

    async updateResult(options) {
        return this._db.jobs.updateResult(options);
    }

    updateStatus(options, updateOnlyActive) {
        return this._db.jobs.updateStatus(options, updateOnlyActive);
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

    _wrapJobsService() {
        Object.getOwnPropertyNames(Object.getPrototypeOf(this._db.jobs)).forEach(propertyName => {
            if (typeof this._db.jobs[propertyName] === 'function') {
                this._db.jobs[propertyName] = this._wrapperForDBProblem(this._db.jobs[propertyName]);
            }
        });
    }

    _wrapperForDBProblem(fn) {
        // eslint-disable-next-line func-names
        const bfn = fn.bind(this._db.jobs);
        if (bfn.constructor.name === 'AsyncFunction') {
            return async (...args) => {
                try {
                    const result = await bfn(...args);
                    return result;
                }
                catch (ex) {
                    this._exitOnDBProblemBinded(ex);
                    throw ex;
                }
            };
        }
        return (...args) => {
            try {
                const result = bfn(...args);
                return result;
            }
            catch (ex) {
                this._exitOnDBProblemBinded(ex);
                throw ex;
            }
        };
    }
}

module.exports = new DB();
