const EventEmitter = require('events');
const EtcdClient = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const { buildStatuses } = require('@hkube/consts');
const component = require('../consts/components').ETCD;
const { redactLines } = require('../utils/text');

let log;

class StateManger extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._etcd = new EtcdClient({ ...options.etcd, serviceName: options.serviceName });
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
        this._etcd.algorithms.builds.on('change', (build) => {
            this.emit(`build-${build.status}`, build);
        });
    }

    async watchBuild(options) {
        return this._etcd.algorithms.builds.watch({ buildId: options.buildId });
    }

    async insertBuild(options) {
        return this._etcd.algorithms.builds.set({ buildId: options.buildId, ...options });
    }

    async updateBuild(options) {
        const results = options;
        const { buildId } = results;
        if (!buildId) {
            return;
        }
        let ok = false;
        let count = 10;
        if (results.result) {
            results.result.data = redactLines(results.result.data);
        }

        await this._db.algorithms.builds.update(results);

        // only on completed we need to update etcd
        if (results.status === buildStatuses.COMPLETED) {
            while (!ok && count > 0) {
                try {
                    await this._etcd.algorithms.builds.update(results); // eslint-disable-line
                    ok = true;
                }
                catch (error) {
                    count -= 1;
                    log.info(`update failed. ${count} retries left. error: ${error.message}`);
                }
            }
        }
    }
}

module.exports = new StateManger();
