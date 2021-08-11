const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const log = require('@hkube/logger').GetLogFromContainer();
const { containers, components } = require('../consts');
const component = components.ETCD;

class EtcdClient extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd(options.etcd);
        log.info(`initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
    }

    async getAlgorithmQueues() {
        return this._etcd.discovery.list({ serviceName: 'algorithm-queue' });
    }

    async getAlgorithmQueuesList() {
        const algs = await this._etcd.algorithms.queue.list();
        const data = algs.reduce((acc, cur) => {
            acc[cur.name] = cur.timestamp;
            return acc;
        }, {});
        return data;
    }

    async sendAlgorithmQueueAction({ queueId, action, algorithmName, timestamp }) {
        return this._etcd.algorithmQueues.set({ queueId, action, algorithmName, timestamp });
    }

    sendCommandToDriver({ driverId, command }) {
        log.info(`driver command: ${command}`, { component, command, driverId });
        return this._etcd.drivers.set({ driverId, status: { command }, timestamp: Date.now() });
    }

    async getPipelineDrivers() {
        const serviceName = containers.PIPELINE_DRIVER;
        const drivers = await this._etcd.discovery.list({ serviceName });
        return drivers;
    }

    async getPipelineDriverRequests() {
        const options = {
            name: 'data'
        };
        return this._etcd.pipelineDrivers.requirements.list(options);
    }
}

module.exports = new EtcdClient();
