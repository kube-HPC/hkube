const storageManager = require('@hkube/storage-manager');
const BaseCleaner = require('./base-cleaner');

class ResultsCleaner extends BaseCleaner {
    async clean({ jobs }) {
        for (let jobId of jobs) { // eslint-disable-line
            const promiseArray = [];
            promiseArray.push(storageManager.hkubeResults.delete({ jobId }));
            promiseArray.push(storageManager.hkubeAlgoMetrics.delete({ jobId }));
            const results = await Promise.allSettled(promiseArray); // eslint-disable-line
            this._handleErrors(results);
        }
    }
}

module.exports = new ResultsCleaner();
