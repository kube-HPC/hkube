
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');

class TemplatesStore extends Adapter {

    constructor(settings, options) {
        super(settings, options);
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