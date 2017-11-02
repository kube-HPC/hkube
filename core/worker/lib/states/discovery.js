const etcd_rf = require('etcd.rf');
const Logger = require('logger.rf');
const uuidv4 = require('uuid/v4');
let log;

class EtcdDiscovery {
    constructor() {
        this._etcd = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new etcd_rf();
        await this._etcd.init(options.etcdDiscovery.init);
        await this._etcd.discovery.register({ serviceName: options.etcdDiscovery.init.serviceName });
    }

    async setState(options) {
        const { data } = options;
        await this._etcd.services.set({
            data,
            postfix: 'state'
        });
    }

    async update(options) {
        await Promise.all([
            this._updateResult(options),
            this._updateStatus(options)
        ]);
    }

    async _updateResult(options) {
        await this._etcd.tasks.setResult(options);
    }

    async _updateStatus(options) {
        await this._etcd.tasks.setStatus(options);
    }
}

module.exports = new EtcdDiscovery();