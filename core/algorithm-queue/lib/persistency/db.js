const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const component = require('../consts/component-name').DB;

class DBConnection {
    constructor() {
        this.connection = null;
    }

    async init(options) {
        const log = Logger.GetLogFromContainer();
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    async getJob({ jobId }) {
        return this._db.jobs.fetchStatus({ jobId });
    }
}

module.exports = new DBConnection();
