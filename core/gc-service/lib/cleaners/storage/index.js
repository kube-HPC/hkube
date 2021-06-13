const storageManager = require('@hkube/storage-manager');
const resultsCleaner = require('./results-cleaner');
const tempCleaner = require('./temp-cleaner');
const indicesCleaner = require('./indices-cleaner');
const BaseCleaner = require('../../core/base-cleaner');

const cleaners = {
    results: resultsCleaner,
    temp: tempCleaner,
    indices: indicesCleaner
};

class StorageCleaner extends BaseCleaner {
    async clean({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        await this.delete(data);
        const { count, sample } = this._createSample(data);
        return this.runResult({ count, sample });
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        const { count, sample } = this._createSample(data);
        return this.dryRunResult({ count, sample });
    }

    async fetch({ maxAge } = {}) {
        const maxAgeResults = this.resolveMaxAge(maxAge, this._config.maxAge.results);
        const maxAgeTemp = this.resolveMaxAge(maxAge, this._config.maxAge.temp);
        const indices = await storageManager.hkubeIndex.listPrefixes();

        const res = await cleaners.results.getJobsToDelete({ indices, maxAge: maxAgeResults });
        const temp = await cleaners.temp.getJobsToDelete({ indices, maxAge: maxAgeTemp });
        const result = {
            results: res.jobsToDelete,
            temp: temp.jobsToDelete,
            indices: res.expiredIndices
        };
        return result;
    }

    async delete(data) {
        await cleaners.results.clean({ jobs: data.results });
        await cleaners.temp.clean({ jobs: data.temp });
        await cleaners.indices.clean({ indices: data.indices });
    }

    _createSample(data) {
        const count = data.results.length + data.temp.length + data.indices.length;
        const sample = {
            results: data.results.slice(0, 10),
            temp: data.temp.slice(0, 10),
            indices: data.indices.slice(0, 10),
        };
        return { count, sample };
    }
}

module.exports = StorageCleaner;
