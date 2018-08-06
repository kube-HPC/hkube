
const Adapter = require('../Adapter');
const stateManager = require('../../state/state-manager');

class TemplatesStoreAdapter extends Adapter {
    constructor(options) {
        super(options);
        stateManager.on('templates-store-change', () => {
            this.updateCache();
        });
    }

    async _getData() {
        const store = await stateManager.getStoreTemplates();
        const data = Object.create(null);
        store.forEach(r => {
            data[r.name] = r;
        });
        return data;
    }
}

module.exports = TemplatesStoreAdapter;
