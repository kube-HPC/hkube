const { nodeKind } = require('@hkube/consts');
const { time } = require('../../helpers');
const storeManager = require('../../utils/store-manager');
const BaseCleaner = require('../../baseCleaner');

class Cleaner extends BaseCleaner {
    async clean({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        await Promise.all(data.map(a => storeManager.deleteAlgByName({ name: a.name })));
        this.setResultCount(data.length);
        return this.getStatus();
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        return this.dryRunResult(data);
    }

    async fetch({ maxAge } = {}) {
        const maxJobAge = this.resolveMaxAge(maxAge, this._config.maxAge);
        const algorithms = await storeManager.getAlgorithms({ kind: nodeKind.Gateway });
        let result = [];

        if (algorithms.length > 0) {
            const jobs = await storeManager.getRunningJobs();
            const jobIds = jobs.map(job => job.jobId);
            result = algorithms.filter(a => time.shouldDelete(a.created, maxJobAge) && !jobIds.includes(a.jobId)).map(a => a.name);
        }
        return result;
    }
}

module.exports = Cleaner;
