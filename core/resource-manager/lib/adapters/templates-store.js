
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');

class TemplatesStoreAdapter extends Adapter {

    constructor(settings, options) {
        super(settings, options);

        stateManager.on('templates-store', () => {
            this.cache.del();
        })
    }

    async getData() {
        let data = this.cache.get();
        if (!data) {
            const store = await stateManager.getStoreTemplates();
            data = Object.create(null);
            store.forEach(r => {
                data[r.alg] = r.data;
            });
            this.cache.set(data);
        }
        return data;
    }
}

module.exports = TemplatesStoreAdapter;