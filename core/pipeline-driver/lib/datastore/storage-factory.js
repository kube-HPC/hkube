const log = require('@hkube/logger').GetLogFromContainer();

class DatastoreFactory {

    async getAdapter(config, bootstrap = false) {
        const storage = config.storageAdapters[config.defaultStorage];
        const adapter = require(storage.moduleName);  // eslint-disable-line
        await adapter.init(storage.connection, log, bootstrap);
        return adapter;
    }
}
module.exports = new DatastoreFactory();
