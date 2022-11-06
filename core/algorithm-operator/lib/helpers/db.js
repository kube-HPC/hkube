const EventEmitter = require('events');
const dbConnect = require('@hkube/db');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../consts/componentNames').ETCD;
const buildStatus = require('../consts/buildStatus');
const { arrayToMap } = require('./utils');

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
        const limit = 100;
        let allRecords = [];
        let prevCursor = null;
        let results;
        do {
            // eslint-disable-next-line no-await-in-loop
            const { hits, cursor } = await this._db.algorithms.searchApi({ cursor: prevCursor, limit });
            results = hits;
            prevCursor = cursor;
            allRecords = [...hits, ...allRecords];
        } while (results.length >= limit);
        return { algorithms: allRecords, count: allRecords.length };
    }

    async getDriversTemplate() {
        const templates = await this._db.pipelineDrivers.fetchAll();
        return arrayToMap(templates);
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

    async getOptunaboards(status) {
        return this._db.optunaboards.search({ status });
    }

    async updateOptunaboard(options) {
        await this._db.optunaboards.update(options);
    }

    async deleteOptunaboard(options) {
        await this._db.optunaboards.delete(options);
    }
}

module.exports = new DB();
