const EventEmitter = require('events');
const etcd_rf = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const uuidv4 = require('uuid/v4');
let log;

class EtcdDiscovery extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new etcd_rf();
        await this._etcd.init(options.etcdDiscovery.init);
        await this._etcd.discovery.register({ serviceName: options.etcdDiscovery.init.serviceName });
        this._etcd.jobs.on('change', res => {
            console.log(JSON.stringify(res));
            switch (res.state) {
                case 'stop':
                this.emit('stop',res);
                    break;
                default:
                    this.emit('change', res);
            }
        })
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

    async watch(options) {
        await this._etcd.jobs.watch(options);
    }
    async unwatch(options) {
        await this._etcd.jobs.unwatch(options);
    }
}

module.exports = new EtcdDiscovery();