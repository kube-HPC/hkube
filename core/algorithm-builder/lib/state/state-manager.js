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
        this._etcd = new EtcdClient();
        log.info(`Initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        await this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
    }

    async getBuild(options) {
        return this._etcd._client.get(`/algorithms/builds/${options.buildId}`, { isPrefix: false });
    }

    async setBuild(options) {
        const { buildId } = options;
        if (!buildId) {
            return;
        }
        await this._etcd._client.client.stm({ retries: 0, isolation: 1 }).transact((tx) => {
            return tx.get(`/algorithms/builds/${buildId}`)
                .then((val) => {
                    const bld = JSON.parse(val);
                    const build = Object.assign({}, bld, { ...options });
                    return tx.put(`/algorithms/builds/${buildId}`).value(JSON.stringify(build));
                });
        });
    }

    async updateAlgorithmImage({ algorithm, algorithmImage }) {
        if (!algorithmImage) {
            return;
        }
        await this._etcd._client.client.stm({ retries: 0, isolation: 1 }).transact((tx) => {
            return tx.get(`/algorithmTemplates/${algorithm.name}`)
                .then((val) => {
                    const alg = JSON.parse(val);
                    const newAlgorithm = Object.assign({}, algorithm, alg, { algorithmImage });
                    return tx.put(`/algorithmTemplates/${algorithm.name}`).value(JSON.stringify(newAlgorithm));
                });
        });
    }
}

module.exports = new StateManger();
