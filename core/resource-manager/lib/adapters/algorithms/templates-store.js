
const Adapter = require('../Adapter');
const stateManager = require('../../state/state-manager');
const Cache = require('../../cache/cache-provider');

class TemplatesStoreAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
        this._cache = new Cache({ key: this.name, maxAge: 1000 * 60 * 1 });
        stateManager.on('templates-store-change', () => {
            this._cache.del();
        });
    }

    async getData() {
        let data = this._cache.get();
        if (!data) {
            const store = await stateManager.getStoreTemplates();
            data = Object.create(null);
            store.forEach(r => {
                data[r.name] = r;
            });
            this._cache.set(data);
        }
        return data;
    }
}

module.exports = TemplatesStoreAdapter;
