const storeManager = require('../../helpers/store-manager');
const BaseCleaner = require('../../core/base-cleaner');

class StatusCleaner extends BaseCleaner {
    async clean() {
        const data = await this.fetch();
        await this.fixStatus(data);
        return this.runResult({ data: data.map(d => d.jobId) });
    }

    async dryRun() {
        const data = await this.fetch();
        return this.dryRunResult({ data: data.map(d => d.jobId) });
    }

    async fetch() {
        const jobs = await storeManager.getInvalidStatusJobs();
        return jobs.filter(d => d.resultStatus);
    }

    async fixStatus(data) {
        await Promise.all(data.map((d) => {
            return storeManager.updateJobStatus({ jobId: d.jobId, status: d.resultStatus });
        }));
    }
}

module.exports = StatusCleaner;
