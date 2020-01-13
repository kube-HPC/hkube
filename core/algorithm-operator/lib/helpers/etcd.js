const EventEmitter = require('events');
const EtcdClient = require('@hkube/etcd');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../lib/consts/componentNames').ETCD;
const { logWrappers } = require('./tracing');


class Etcd extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        this._etcd = new EtcdClient(options.etcd);
        log.info(`Initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        if (options.healthchecks.logExternalRequests) {
            logWrappers([
                'getAlgorithmTemplate',
                'getAlgorithmTemplates',
                'storeAlgorithmData',
                'removeAlgorithmData',
                'getBuilds',
                'setBuild'
            ], this, log);
        }
        await this._etcd.jobs.status.watch({ jobId: 'hookWatch' });
    }

    getAlgorithmTemplate({ name }) {
        return this._etcd.algorithms.store.get({ name });
    }

    getAlgorithmTemplates() {
        return this._etcd.algorithms.store.list();
    }

    storeAlgorithmData(name, data) {
        return this._etcd.algorithms.debug.set({ name, ...data });
    }

    removeAlgorithmData(name) {
        return this._etcd.algorithms.debug.delete({ name });
    }

    async getBuilds() {
        return this._etcd.algorithms.builds.list({ sort: 'desc' });
    }

    async setBuild(options) {
        await this._etcd.algorithms.builds.update(options);
    }

    async getTensorboards() {
        const batches = (await this._etcd.tensorboard.batch.list()).map(batch => ({ ...batch, type: 'batch' }));
        const tasks = (await this._etcd.tensorboard.task.list()).map(task => ({ ...task, type: 'task' }));
        const nodes = (await this._etcd.tensorboard.node.list()).map(node => ({ ...node, type: 'node' }));
        return [...batches, ...tasks, ...nodes];
    }

    async updateTensorboard(options) {
        await this._etcd.tensorboard[options.type].update(options);
    }
}

module.exports = new Etcd();
