const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const BaseCleaner = require('./base-cleaner');
const promiseWrapper = require('./promise-wrapper');

class TempCleaner extends BaseCleaner {
    async getJobsToDelete({ indices, maxAge }) {
        return super.getJobsToDelete({ indices, maxAge });
    }

    async clean({ jobs }) {
        try {
            for (let jobId of jobs) { // eslint-disable-line
                const promiseArray = [];
                promiseArray.push(promiseWrapper(() => storageManager.hkube.delete({ jobId }))); // eslint-disable-line
                promiseArray.push(promiseWrapper(() => storageManager.hkubeMetadata.delete({ jobId }))); // eslint-disable-line
                promiseArray.push(promiseWrapper(() => storageManager.hkubeExecutions.delete({ jobId }))); // eslint-disable-line
                const results = await Promise.all(promiseArray); // eslint-disable-line
                this._handleErrors(results);
            }
        }
        catch (error) {
            log.error(error);
        }
    }
}

module.exports = new TempCleaner();
