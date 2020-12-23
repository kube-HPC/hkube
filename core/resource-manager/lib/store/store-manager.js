const Etcd = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const component = require('../consts/components').DB;

class StoreManager {
    async init(options) {
        const log = Logger.GetLogFromContainer();
        this._etcd = new Etcd({ ...options.etcd, serviceName: options.serviceName });
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    async getAlgorithmQueue() {
        return this._etcd.algorithms.queue.list();
    }

    async getAlgorithmTemplateStore() {
        return this._db.algorithms.search({
            isDebug: false,
            isPending: false,
            sort: { created: 'desc' },
            limit: 100,
        });
    }

    async setAlgorithmsResourceRequirements(options) {
        return this._etcd.algorithms.requirements.set(options);
    }

    async getPipelineDriverQueue(options) {
        return this._etcd.pipelineDrivers.queue.list(options);
    }

    async getPipelineDriverTemplateStore() {
        return this._db.pipelineDrivers.fetchAll();
    }

    async setPipelineDriverRequirements(resourceResults) {
        return this._etcd.pipelineDrivers.requirements.set(resourceResults);
    }
}

module.exports = new StoreManager();
