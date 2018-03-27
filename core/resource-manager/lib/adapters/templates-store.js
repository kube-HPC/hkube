
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');

class TemplatesStore extends Adapter {

    constructor(settings, options) {
        super(settings, options);
    }

    async getData() {
        let data = this.cache.get();
        if (!data) {
            data = await stateManager.getStoreTemplates();
            this.cache.set(data);
        }
        const map = Object.create(null);
        data.forEach(r => {
            map[r.alg] = r.data;
        });
        return map;
    }
}

module.exports = TemplatesStore;