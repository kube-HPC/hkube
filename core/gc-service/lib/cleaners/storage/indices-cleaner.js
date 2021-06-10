const storageManager = require('@hkube/storage-manager');
const BaseCleaner = require('./base-cleaner');

class IndicesCleaner extends BaseCleaner {
    async clean({ indices }) {
        if (indices.length > 0) {
            const results = await Promise.allSettled(indices.map(date => storageManager.hkubeIndex.delete({ date })));
            this._handleErrors(results);
        }
    }
}

module.exports = new IndicesCleaner();
