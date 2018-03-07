class StorageFactory {
    async init(config) {
        const storage = config.storageAdapters[config.defaultStorage];
        this.adapter = require(storage.moduleName);  // eslint-disable-line
        await this.adapter.init(storage.connection);
    }

    async setResultsFromStorage(options) {
        if (options.data.result) {
            options.data.result = await Promise.all(options.data.result.map(a => this._getStorageItem(a)));
        }
    }

    async _getStorageItem(options) {
        const result = await this.adapter.get(options.result);
        return { ...options, result };
    }
}
module.exports = new StorageFactory();
