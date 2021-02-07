const Logger = require('@hkube/logger');
const { MasterAdapter, SlaveAdapter } = require('./index');
const { Components } = require('../../consts');
let log;

/**
 * The adapters proxy is responsible to communicate
 * with the adapters (master/slave)
 */
class AdaptersProxy {
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

    async stop() {
        return Promise.all(Object.values(this._adapters).map(a => a.finish()));
    }

    report(options) {
        const { nodeName } = options;
        this._adapters[nodeName].report(options);
    }

    scale() {
        const masters = this.getMasters();
        return masters.map(m => m.scale());
    }

    metrics() {
        const masters = this.getMasters();
        const result = [];
        masters.forEach(m => {
            const metrics = m.getMetrics();
            result.push(...metrics);
        });
        return result;
    }

    getMasters() {
        return Object.values(this._adapters).filter(a => a.isMaster);
    }
}

module.exports = AdaptersProxy;
