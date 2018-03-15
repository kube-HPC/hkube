
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

    getData() {
        return Promise.all(this._adapters.map(a => this._getData(a)));
    }

    async _getData(adapter) {
        const data = await adapter.getData();
        return { [adapter.name]: data };
    }
}

module.exports = new AdapterManager();