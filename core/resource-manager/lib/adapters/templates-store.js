
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const stub = require('../../tests/mocks/templates-store.json');

class TemplatesStore extends Adapter {

    constructor(options) {
        super(options);
        this._stubData();
    }

    _stubData() {
        Promise.all(stub.map(a => stateManager.setStoreTemplates(a)));
    }

    async getData() {
        const map = Object.create(null);
        const response = await stateManager.getStoreTemplates();
        response.forEach(r => {
            map[r.alg] = r.data;
        });
        return map;
    }
}

module.exports = TemplatesStore;