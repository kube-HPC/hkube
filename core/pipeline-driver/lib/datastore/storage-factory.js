const log = require('@hkube/logger').GetLogFromContainer();

class StorageFactory {
    constructor() {
        this._adapter = null;
    }

    async init(config, bootstrap = false) {
        const storage = config.storageAdapters[config.defaultStorage];
        this._adapter = require(storage.moduleName);  // eslint-disable-line
        await this._adapter.init(storage.connection, log, bootstrap);
    }

    getAdapter() {
        return this._adapter;
    }
}

module.exports = new StorageFactory();
