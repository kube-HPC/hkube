const EventEmitter = require('events');
const EtcdClient = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const component = require('../../lib/consts/components').ETCD;
let log;

class Etcd {
    constructor() {
        this._etcd = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new EtcdClient();
        log.info(`Initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        await this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        await this._etcd.jobState.watch({ jobId: 'hookWatch' });
    }

    async getBuild(buildId) {
        const build = await this._etcd._client.get(`/builds/${buildId}`, { isPrefix: false });
        return build;
    }
}

module.exports = new Etcd();
