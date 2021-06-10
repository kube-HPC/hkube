const storageManager = require('@hkube/storage-manager');
const BaseCleaner = require('./base-cleaner');

class TempCleaner extends BaseCleaner {
    async clean({ jobs }) {
        for (let jobId of jobs) { // eslint-disable-line
            const promiseArray = [];
            promiseArray.push(storageManager.hkube.delete({ jobId }));
            promiseArray.push(storageManager.hkubeMetadata.delete({ jobId }));
            promiseArray.push(storageManager.hkubeExecutions.delete({ jobId }));
            const results = await Promise.allSettled(promiseArray); // eslint-disable-line
            this._handleErrors(results);
        }
    }
}

module.exports = new TempCleaner();
