const { isTimeBefore } = require('../utils/time');
const storeManager = require('../helpers/store-manager');

class KindCleaner {
    async delete({ data, kind }) {
        const result = await Promise.all(data.map(a => storeManager.deleteAlgByName({ name: a, kind })));
        return result;
    }

    async fetch({ kind, maxAge }) {
        const algorithms = await storeManager.getAlgorithms({ kind });
        let result = [];
        if (algorithms.length > 0) {
            const jobs = await storeManager.getRunningJobs();
            const runningAlgorithms = new Set(jobs.map(job => job.nodes.map(n => n.algorithmName)).flat());
            result = algorithms.filter(a => isTimeBefore(a.modified, maxAge) && !runningAlgorithms.has(a.name)).map(a => a.name);
        }
        return result;
    }
}

module.exports = new KindCleaner();
