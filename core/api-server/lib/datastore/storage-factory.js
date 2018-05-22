const log = require('@hkube/logger').GetLogFromContainer();

class StorageFactory {
    async init(config) {
        const storage = config.storageAdapters[config.defaultStorage];
        this.moduleName = storage.moduleName;
        this.adapter = require(storage.moduleName);  // eslint-disable-line
        await this.adapter.init(storage.connection, log);
    }

    async _setResultsFromStorage(options) {
        let response = options;
        if (options.data) {
            response = await Promise.all(options.data.map(a => this._getStorageItem(a)));
        }
        return response;
    }

    async _getStorageItem(options) {
        if (options.result && options.result.storageInfo) {
            const result = await this.adapter.get(options.result.storageInfo);
            return { ...options, result };
        }
        return { ...options };
    }

    async getResults(options) {
        if (options && options.data) {
            const data = await this.adapter.getResults({ jobId: options.jobId });
            const result = await this._setResultsFromStorage({ data });
            return { ...options, data: result, storageModule: this.moduleName };
        }
        return options;
    }
}

module.exports = new StorageFactory();
