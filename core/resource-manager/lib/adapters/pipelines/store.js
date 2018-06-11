const Adapter = require('../Adapter');
const stateManager = require('../../state/state-manager');

class StoreAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
    }

    async getData() {
        return [];
    }

    async setData(data) {
        return stateManager.setPipelineDriverRequirements(data);
    }
}

module.exports = StoreAdapter;
