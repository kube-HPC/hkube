const log = require('@hkube/logger').GetLogFromContainer();
const adapterTypes = require('./index');
const utils = require('../utils/utils');

class AdapterController {
    constructor(config, settings) {
        this._adapters = Object.create(null);
        this._config = config;
        this._settings = settings;
    }

    async init() {
        await Promise.all(Object.entries(adapterTypes).map(([k, v]) => this._initAdapters(k, v)));
    }

    async _initAdapters(type, collection) {
        const results = await Promise.all(Object.entries(collection)
            .filter(([name]) => utils.filterEnable(this._settings, name, type))
            .map(([name, adapter]) => this._initAdapter(type, name, adapter)));
        this._adapters[type] = utils.arrayToMap(results);
    }

    async _initAdapter(type, name, Adapter) {
        const setting = this._settings[type][name];
        const options = {
            name,
            setting,
            config: this._config
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
                log.throttle.error(result.error.message, { component: adapter.name });
            }
        }
        return { key: adapter.name, value: result.data };
    }
}

module.exports = AdapterController;
