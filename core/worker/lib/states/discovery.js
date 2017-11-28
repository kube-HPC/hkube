const etcd_rf = require('@hkube/etcd');
const Logger = require('@hkube/logger');
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
        await this._etcd.tasks.setState(options);
    }

    async watch(options){
        await this._etcd.jobs.watch(options);
    }
    async unwatch(options){
        await this._etcd.jobs.unwatch(options);
    }
}

module.exports = new EtcdDiscovery();