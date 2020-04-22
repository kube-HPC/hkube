const { jobStatus } = require('../consts');

class Storage {
    async getResultFromStorage(data) {
        return { data };
    }

    async setResultToStorage(options) {
        const status = jobStatus.SUCCEED;
        const { lastStorageInfo } = options;

        return {
            status,
            storageInfo: lastStorageInfo
        };
    }
}

module.exports = new Storage();
