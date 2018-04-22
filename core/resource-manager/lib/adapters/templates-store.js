
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');

class TemplatesStoreAdapter extends Adapter {

    constructor(settings, options) {
        super(settings, options);

        stateManager.on('templates-store', () => {
            this.cache.del();
        })

        const defaultTemplates = [
            {
                "alg": "green-alg",
                "data": {
                    "cpu": 5000,
                    "mem": 256000
                }
            },
            {
                "alg": "eval-alg",
                "data": {
                    "cpu": 500,
                    "mem": 256000
                }
            },
            {
                "alg": "yellow-alg",
                "data": {
                    "cpu": 2000,
                    "mem": 1024000
                }
            },
            {
                "alg": "black-alg",
                "data": {
                    "cpu": 1000,
                    "mem": 2048000
                }
            }
        ].forEach(t => stateManager.setStoreTemplates(t));
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