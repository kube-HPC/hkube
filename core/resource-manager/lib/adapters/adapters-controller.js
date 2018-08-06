
const adapterTypes = require('./index');
const adapterSettings = require('./settings');
const utils = require('../utils/utils');
const logger = require('../utils/logger');

class AdapterController {
    constructor() {
        this._adapters = Object.create(null);
    }

    async init(options) {
        await Promise.all(Object.entries(adapterTypes).map(([k, v]) => this._initAdapters(k, v, options)));
    }

    async _initAdapters(type, collection, options) {
        const results = await Promise.all(Object.entries(collection)
            .filter(([name]) => utils.filterEnable(adapterSettings, name, type))
            .map(([name, adapter]) => this._initAdapter(type, name, adapter, options)));
        this._adapters[type] = utils.arrayToMap(results);
    }

    async _initAdapter(type, name, Adapter, config) {
        const setting = adapterSettings[type][name];
        const options = {
            name,
            setting,
            config
        };
        const adapter = new Adapter(options);
        await adapter.init();
        return { key: adapter.name, value: adapter };
    }

    /**
     * This method execute parallel getData requests for each adapter
     * 
     * @returns 
     * 
     * @memberOf AdapterController
     */
    async getData() {
        const results = Object.create(null);
        await Promise.all(Object.entries(this._adapters).map(([k, v]) => this._getAdaptersData(k, v, results)));
        return results;
    }

    async _getAdaptersData(type, adapters, results) {
        const response = await Promise.all(Object.values(adapters).map(a => this._getAdapterData(type, a)));
        results[type] = utils.arrayToMap(response);
    }

    async _getAdapterData(type, adapter) {
        const result = await adapter.getData();
        if (result.error) {
            if (adapter.mandatory) {
                throw new Error(`unable to get data for ${adapter.name} adapter in ${type}, ${result.error.message}`);
            }
            else {
                logger.log(result.error, adapter.name);
            }
        }
        return { key: adapter.name, value: result.data };
    }

    async setData(metricsResults) {
        return Promise.all(Object.entries(this._adapters).map(([k, v]) => v.store && v.store.setData(metricsResults[k])));
    }
}

module.exports = new AdapterController();
