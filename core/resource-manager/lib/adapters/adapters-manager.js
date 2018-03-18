
class AdapterManager {

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
        catch (e) {

        }
        return { [adapter.name]: data };
    }
}

module.exports = new AdapterManager();