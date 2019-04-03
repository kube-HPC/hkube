const EventEmitter = require('events');
const merge = require('lodash.merge');
const EtcdClient = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const component = require('../../lib/consts/componentNames').ETCD;
let log;

class Etcd extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new EtcdClient();
        log.info(`Initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        await this._etcd.init(options.etcd);
        await this._etcd.jobState.watch({ jobId: 'hookWatch' });
    }

    getAlgorithmTemplate({ algorithmName }) {
        return this._etcd.algorithms.templatesStore.get({ name: algorithmName });
    }

    getAlgorithmTemplates() {
        return this._etcd.algorithms.templatesStore.list();
    }

    async getPendingBuilds() {
        const list = await this._etcd._client.getByQuery('/algorithms/builds/', { sort: 'desc' });
        const results = list.map(l => l.value);
        return results.filter(b => b.status === 'pending');
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
                    const build = merge(bld, options);
                    return tx.put(`/algorithms/builds/${buildId}`).value(JSON.stringify(build));
                });
        });
    }
}

module.exports = new Etcd();
