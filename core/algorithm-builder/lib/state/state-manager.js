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

    async setBuild(buildId, options) {
        return this._etcd._client.put(`/algorithms/builds/${buildId}`, options);
    }

    async updateAlgorithmImage({ algorithmName, algorithmImage }) {
        if (!algorithmImage) {
            return;
        }
        await this._etcd._client.client.stm({ retries: 0, isolation: 1 }).transact((tx) => {
            return tx.get(`/algorithmTemplates/${algorithmName}`)
                .then((val) => {
                    const alg = JSON.parse(val);
                    const algorithm = Object.assign({}, alg, { algorithmImage });
                    return tx.put(`/algorithmTemplates/${algorithmName}`).value(JSON.stringify(algorithm));
                });
        });
    }
}

module.exports = new StateManger();
