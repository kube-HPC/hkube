const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').ADAPTER_CONTROLLER;

class AdapterController {

    constructor() {
        this._adapters = [];
    }

    init(options) {
        options.metrics.forEach(a => {
            let Adapter = require(__dirname + '/' + a.name);
            this._adapters.push(new Adapter(a));
        });
    }

    async getData() {
        const map = Object.create(null);
        const response = await Promise.all(this._adapters.map(a => this._getData(a)));
        response.forEach(r => {
            let [k, v] = Object.entries(r)[0]
            map[k] = v;
        });
        return map;
    }

    async _getData(adapter) {
        let data;
        try {
            data = await adapter.getData();
        }
        catch (error) {
            log.error(error.message, { component });
        }
        return { [adapter.name]: data };
    }
}

module.exports = new AdapterController();