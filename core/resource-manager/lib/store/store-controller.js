const storeFactory = require('../factory/store-factory');

class StoreController {
    constructor(config) {
        this._stores = Object.create(null);
        const stores = storeFactory.getStores(config.recommendationMode);
        Object.entries(stores).forEach(([k, v]) => {
            this._stores[k] = Object.values(v).map((Store) => new Store());
        });
    }

    setData(metricsResults) {
        return Promise.all(Object.entries(this._stores).map(([k, v]) => this._setData(k, v, metricsResults)));
    }

    _setData(type, adapters, metricsResults) {
        return Promise.all(adapters.map(a => a.setData(metricsResults[type])));
    }
}

module.exports = StoreController;
