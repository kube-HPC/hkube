const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').ADAPTER_CONTROLLER;
const utils = require('../utils/utils');

class AdapterController {

    constructor(options) {
        this._adapters = [];
        this._init(options);
    }

    _init(options) {
        options.resourceProviders.map(a => ({ ...a.adapter, name: a.name })).forEach(a => {
            const Adapter = require(__dirname + '/' + a.name);
            this._adapters.push(new Adapter(options, a));
        });
    }

    /**
     * This method execute parallel getData requests for each adapter
     * 
     * @returns 
     * 
     * @memberOf AdapterController
     */
    async getData() {
        const response = await Promise.all(this._adapters.map(a => this._getData(a)));
        return utils.arrayToMap(response);
    }

    async _getData(adapter) {
        const data = await adapter.getData();
        return { key: adapter.name, value: data };
    }
}

module.exports = AdapterController;