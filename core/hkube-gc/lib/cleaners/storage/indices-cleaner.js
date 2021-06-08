const storageManager = require('@hkube/storage-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const BaseCleaner = require('./base-cleaner');
const promiseWrapper = require('./promise-wrapper');

class IndicesCleaner extends BaseCleaner {
    async getJobsToDelete({ indices, maxAgeResults }) {
        return super.getJobsToDelete({ indices, maxAge: maxAgeResults });
    }

    async clean({ indices }) {
        try {
            if (indices.length > 0) {
                log.info(`found ${indices.length} expired indices`);
                const results = await Promise.all(indices.map(date => promiseWrapper(() => storageManager.hkubeIndex.delete({ date }))));
                this._handleErrors(results);
            }
        }
        catch (error) {
            log.error(error);
        }
    }
}

module.exports = new IndicesCleaner();
