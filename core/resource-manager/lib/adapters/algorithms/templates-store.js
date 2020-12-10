const Adapter = require('../Adapter');
const stateManager = require('../../store/store-manager');

class TemplatesStoreAdapter extends Adapter {
    async _getData() {
        const store = await stateManager.getAlgorithmTemplateStore();
        const data = Object.create(null);
        store.forEach(r => {
            data[r.name] = r;
        });
        return data;
    }
}

module.exports = TemplatesStoreAdapter;
