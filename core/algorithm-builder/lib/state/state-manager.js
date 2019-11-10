const merge = require('lodash.merge');
const EtcdClient = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const component = require('../consts/components').ETCD;

let log;

class StateManger {
    constructor() {
        this._etcd = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new EtcdClient({ ...options.etcd, serviceName: options.serviceName });
        log.info(`Initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
    }

    async getBuild(options) {
        return this._etcd.algorithms.builds.get({ buildId: options.buildId });
    }

    async insertBuild(options) {
        return this._etcd.algorithms.builds.set({ buildId: options.buildId, ...options });
    }

    async updateBuild(options) {
        const { buildId } = options;
        if (!buildId) {
            return;
        }
        await this._etcd.algorithms.builds.update(options);
    }

    async updateAlgorithmImage({ algorithmName, algorithmImage }) {
        if (!algorithmImage) {
            return;
        }
        const currentVersion = await this._etcd.algorithms.store.get({ name: algorithmName });
        if (!currentVersion) {
            throw new Error(`unable to find algorithm -> ${algorithmName}`);
        }
        const newAlgorithm = merge({}, currentVersion, { algorithmImage, options: { pending: false } });
        await this._etcd.algorithms.versions.set(newAlgorithm);
    }
}

module.exports = new StateManger();
