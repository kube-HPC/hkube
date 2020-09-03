const Logger = require('@hkube/logger');
const { MasterAdapter, SlaveAdapter } = require('./index');
const { Components } = require('../../consts');
let log;

/**
 * The adapters proxy is responsible to communicate
 * with the adapters (master/slave)
 */
class AdaptersManager {
    constructor() {
        log = Logger.GetLogFromContainer();
        this._adapters = Object.create(null);
    }

    addAdapter(options) {
        const { source, nodeName, isMaster } = options;
        const adapter = this._adapters[nodeName];
        if (!adapter) {
            if (isMaster) {
                this._addMaster(options);
                log.info(`current node (${source}) become master for node ${nodeName}`, { component: Components.MASTER_ADAPTER });
            }
            else {
                this._addSlave(options);
                log.info(`current node (${source}) become slave for node ${nodeName}`, { component: Components.SLAVE_ADAPTER });
            }
        }
        else if (!adapter.isMaster && isMaster) {
            this._addMaster(options);
            log.info(`current node (${source}) is switching from slave to master for node ${nodeName}`, { component: Components.MASTER_ADAPTER });
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

    stop() {
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

    throughput() {
        const masters = this._getMasters();
        return masters.map(m => ({ nodeName: m.nodeName, throughput: m.getThroughput() }));
    }

    _getMasters() {
        return Object.values(this._adapters).filter(a => a.isMaster);
    }
}

module.exports = AdaptersManager;
