const logger = require('@hkube/logger');
let log;

class StorageFactory {
    constructor() {
        this._adapter = null;
    }

    async init(config, bootstrap = false) {
        log = logger.GetLogFromContainer();
        const storage = config.storageAdapters[config.defaultStorage];
        this._adapter = require(storage.moduleName);  // eslint-disable-line
        await this._adapter.init(storage.connection, log, bootstrap);
    }

    getAdapter() {
        return this._adapter;
    }
}

module.exports = new StorageFactory();
