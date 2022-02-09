const moment = require('moment');
const storeManager = require('../../helpers/store-manager');
const apiServer = require('./api-server-client');
const BaseCleaner = require('../../core/base-cleaner');

class PipelinesCleaner extends BaseCleaner {
    constructor(config) {
        super(config);
        apiServer.init(this._config);
    }

    async clean() {
        const data = await this.fetch();
        await this.delete(data);
        return this.runResult({ data: data.map(d => d.jobId) });
    }

    async dryRun() {
        const data = await this.fetch();
        return this.dryRunResult({ data: data.map(d => d.jobId) });
    }

    async fetch() {
        const pipelines = await storeManager.getRunningJobs();
        const keys = pipelines.map(p => {
            const now = Date.now();
            const expirationTime = p.ttl ? moment(p.startTime).add(p.ttl, 'seconds') : null;
            const activeExpirationTime = p.activeTime && p.activeTtl ? moment(p.activeTime).add(p.activeTtl, 'seconds') : null;
            let shouldStop = false;
            let reason = 'pipeline expired';
            if (expirationTime && expirationTime < now) {
                shouldStop = true;
            }
            else if (activeExpirationTime && activeExpirationTime < now) {
                shouldStop = true;
                reason = 'pipeline active TTL expired';
            }
            return { shouldStop, jobId: p.jobId, reason };
        }).filter(p => p.shouldStop);
        return keys;
    }

    async delete(data) {
        await Promise.all(data.map(d => apiServer.stop({ jobId: d.jobId, reason: d.reason })));
    }
}

module.exports = PipelinesCleaner;
