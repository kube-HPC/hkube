const { MasterAdapter, SlaveAdapter } = require('./index');

class Adapters {
    constructor() {
        this._adapters = Object.create(null);
    }

    addMaster(options) {
        const { nodeName } = options;
        this._adapters[nodeName] = new MasterAdapter(options);
    }

    addSlave(options) {
        const { nodeName } = options;
        this._adapters[nodeName] = new SlaveAdapter(options);
    }

    finish() {
        return Object.values(this._adapters).map(a => a.finish());
    }

    report(options) {
        const { nodeName } = options;
        this._adapters[nodeName].report(options);
    }

    scale() {
        const masters = this._getMasters();
        return masters.map(m => m.scale());
    }

    progress() {
        const masters = this._getMasters();
        return masters.map(m => m.progress);
    }

    _getMasters() {
        return Object.values(this._adapters).filter(a => a.isMaster);
    }
}

module.exports = Adapters;
