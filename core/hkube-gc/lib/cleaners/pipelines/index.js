const storeManager = require('../../utils/store-manager');
const apiServer = require('./api-server-client');
const BaseCleaner = require('../../baseCleaner');

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
        const keys = [];
        const pipelines = await storeManager.getRunningJobs();
        pipelines.forEach((p) => {
            const expirationTime = p.startTime + (p.ttl * 1000);
            if (expirationTime < Date.now()) {
                keys.push(p.jobId);
            }
        });
        return keys;
    }
}

module.exports = Cleaner;
