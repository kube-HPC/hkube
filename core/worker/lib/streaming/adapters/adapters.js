const Logger = require('@hkube/logger');
const { MasterAdapter, SlaveAdapter } = require('./index');
const { Components } = require('../../consts');
let log;

class Adapters {
    constructor() {
        log = Logger.GetLogFromContainer();
        this._adapters = Object.create(null);
    }

    addAdapter({ isMaster, options }) {
        const { nodeName } = options;
        const adapter = this._adapters[nodeName];
        if (!adapter) {
            if (isMaster) {
                this._addMaster(options);
                log.info(`master is added for node ${nodeName}`, { component: Components.MASTER_SCALER });
            }
            else {
                this._addSlave(options);
                log.info(`slave is added for node ${nodeName}`, { component: Components.SLAVE_SCALER });
            }
        }
        else if (!adapter.isMaster && isMaster) {
            this._addMaster(options);
            log.info(`switching from slave to master for node ${nodeName}`, { component: Components.MASTER_SCALER });
        }
    }

    _addMaster(options) {
        const { nodeName } = options;
        this._adapters[nodeName] = new MasterAdapter(options);
    }

    _addSlave(options) {
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
        return masters.map(m => ({ node: m.nodeName, progress: m.getProgress() }));
    }

    _getMasters() {
        return Object.values(this._adapters).filter(a => a.isMaster);
    }
}

module.exports = Adapters;
