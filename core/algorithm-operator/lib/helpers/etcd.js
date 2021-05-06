const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').ETCD;

class EtcdClient extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd(options.etcd);
        log.info(`initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
    }

    async getAlgorithmQueues() {
        return this._etcd.discovery.list({ serviceName: 'algorithm-queue' });
    }

    async sendAlgorithmQueueAction({ queueId, action, algorithmName }) {
        return this._etcd.algorithmQueues.set({ queueId, action, algorithmName });
    }
}

module.exports = new EtcdClient();
