const fs = require('fs');
const path = require('path');
const utils = require('../utils/utils');

class AdapterController {
    constructor(options) {
        this._adapters = Object.create(null);
        this._init(options);
    }

    _init(options) {
        const folders = fs.readdirSync(path.join(__dirname)).map(n => path.join(__dirname, n)).filter(s => fs.lstatSync(s).isDirectory());
        folders.forEach(f => {
            const folder = path.basename(f);
            const type = utils.capitalize(folder);
            this._adapters[type] = Object.create(null);
            const files = fs.readdirSync(path.join(__dirname, folder)).filter(a => !a.startsWith('_'));
            files.forEach(fi => {
                const file = path.basename(fi, '.js');
                const name = utils.capitalize(file);
                const Adapter = require(`./${folder}/${file}`);
                this._adapters[type][name] = new Adapter(options, name);
            });
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
        const results = Object.create(null);
        await Promise.all(Object.entries(this._adapters).map(([k, v]) => this._fetch(k, v, results)));
        return results;
    }

    async _fetch(k, v, results) {
        const response = await Promise.all(Object.values(v).map(a => this._getData(a)));
        results[k] = utils.arrayToMap(response);
    }

    async _getData(adapter) {
        const data = await adapter.getData();
        return { key: adapter.name, value: data };
    }

    async setData(type, data) {
        return this._adapters[type].store.setData(data);
    }
}

module.exports = AdapterController;
