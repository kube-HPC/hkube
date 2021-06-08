const storeManager = require('../../helpers/store-manager');
const apiServer = require('./api-server-client');
const BaseCleaner = require('../../core/base-cleaner');

class Cleaner extends BaseCleaner {
    constructor(config) {
        super(config);
        apiServer.init(this._config);
    }

    async clean() {
        const data = await this.fetch();
        await Promise.all(data.map(d => apiServer.stop({ jobId: d, reason: 'pipeline expired' })));
        this.setResultCount(data.length);
        return this.getStatus();
    }

    async dryRun() {
        const data = await this.fetch();
        return this.dryRunResult(data);
    }

    async fetch() {
        const pipelines = await storeManager.getRunningJobs();
        const keys = pipelines.filter(p => p.startTime + (p.ttl * 1000) < Date.now()).map(p => p.jobId);
        return keys;
    }
}

module.exports = Cleaner;
