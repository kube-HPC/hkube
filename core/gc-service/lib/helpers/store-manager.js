const dbConnect = require('@hkube/db');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').STATE_MANAGER;

class StoreManager {
    async init(options) {
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    async getRunningJobs() {
        return this._db.jobs.search({
            hasResult: false,
            fields: {
                jobId: true,
                startTime: 'pipeline.startTime',
                ttl: 'pipeline.options.ttl',
                nodes: 'pipeline.nodes',
            },
        });
    }

    async deleteAlgByName({ name, kind }) {
        return this._db.algorithms.delete({ name, kind });
    }

    async getAlgorithms(query) {
        return this._db.algorithms.search({
            ...query,
            fields: {
                jobId: true,
                name: true,
                modified: true
            }
        });
    }

    scanMountedDataSources(options) {
        return this._db.jobs.scanMountedDataSources(options);
    }

    close(force) {
        return this._db.close(force);
    }
}

module.exports = new StoreManager();
