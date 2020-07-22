const EventEmitter = require('events');
const EtcdClient = require('@hkube/etcd');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').ETCD;
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
        return this._etcd.tensorboard.list();
    }

    async updateTensorboard(options) {
        await this._etcd.tensorboard.update(options);
    }

    async deleteTensorboard(options) {
        await this._etcd.tensorboard.delete(options);
    }
}

module.exports = new Etcd();
