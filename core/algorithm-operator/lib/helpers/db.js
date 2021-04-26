const EventEmitter = require('events');
const dbConnect = require('@hkube/db');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').ETCD;
const buildStatus = require('../consts/buildStatus');

class DB extends EventEmitter {
    async init(options) {
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    getAlgorithmTemplate({ name }) {
        return this._db.algorithms.fetch({ name });
    }

    async getAlgorithmTemplates() {
        const [algorithms, count] = await Promise.all([
            this._db.algorithms.search({ sort: { modified: 'desc' }, limit: 100 }),
            this._db.algorithms.count()
        ]);
        return { algorithms, count };
    }

    async getBuilds() {
        return this._db.algorithms.builds.search({
            statuses: [buildStatus.PENDING, buildStatus.STOPPED],
            sort: { startTime: 'desc' }
        });
    }

    async setBuild(options) {
        await this._db.algorithms.builds.update(options);
    }

    async getTensorboards(status) {
        return this._db.tensorboards.search({ status });
    }

    async updateTensorboard(options) {
        await this._db.tensorboards.update(options);
    }

    async deleteTensorboard(options) {
        await this._db.tensorboards.delete(options);
    }
}

module.exports = new DB();
