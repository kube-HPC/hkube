
const Adapter = require('../Adapter');

class TemplatesStoreAdapter extends Adapter {
    constructor(options) {
        super(options);
    }

    async _getData() {
        const data = Object.create(null);
        data['pipeline-job'] = {
            cpu: 0.01,
            mem: 128
        };
        return data;
    }
}

module.exports = TemplatesStoreAdapter;
