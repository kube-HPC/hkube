class DatastoreHelper {
    constructor() {
        this._adapter = null;
    }

    async init(config, log, bootstrap = false) {
        const storage = config.storageAdapters[config.defaultStorage];
        this.moduleName = storage.moduleName;
        this._adapter = require(storage.moduleName);  // eslint-disable-line
        await this._adapter.init(storage.connection, log, bootstrap);
    }

    getAdapter() {
        return this._adapter;
    }

    /**
     * Get subPipeline results from storage
     * @param {object} options 
     */
    async getResults(options) {
        if (options && options.data && options.data.storageInfo) {
            try {
                const data = await this._adapter.get(options.data.storageInfo);
                return { ...options, data, storageModule: this.moduleName };
            }
            catch (error) {
                return {error: new Error(`failed to get results from storage: ${error.message}`)};  
            }
        }
        return {error: new Error('got invalid results from storage')};
    }
}
module.exports = new DatastoreHelper();
