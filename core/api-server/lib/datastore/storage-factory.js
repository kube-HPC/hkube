const log = require('@hkube/logger').GetLogFromContainer();

class StorageFactory {
    async init(config) {
        const storage = config.storageAdapters[config.defaultStorage];
        this.moduleName = storage.moduleName;
        this.adapter = require(storage.moduleName);  // eslint-disable-line
        await this.adapter.init(storage.connection, log, true);
    }

    async _setResultsFromStorage(options) {
        let response = options;
        if (options.data) {
            response = await Promise.all(options.data.map(a => this._getStorageItem(a)));
        }
        return response;
    }

    async getResults(options) {
        if (options && options.data) {
            const data = await this.adapter.get(options.data.storageInfo);
            return { ...options, data, storageModule: this.moduleName };
        }
        return options;
    }
}

module.exports = new StorageFactory();
