class DatastoreFactory {
    async getAdapter(config) {
        const adapter = require(config.moduleName);
        await adapter.init(config.connection);
        return adapter;
    }
}
module.exports = new DatastoreFactory();
