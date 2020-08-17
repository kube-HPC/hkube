const { MasterAdapter, SlaveAdapter } = require('./index');

class Adapters {
    constructor() {
        this._adapters = Object.create(null);
    }

    addMaster(options) {
        const { nodeName } = options;
        this._adapters[nodeName] = new MasterAdapter();
    }

    addSlave(options) {
        const { nodeName } = options;
        this._adapters[nodeName] = new SlaveAdapter();
    }
}

module.exports = Adapters;
