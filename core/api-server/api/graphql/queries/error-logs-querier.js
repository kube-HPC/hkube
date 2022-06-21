const { Factory } = require('@hkube/redis-utils');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../../../lib/consts/componentNames');
const LOGS_PREFIX = 'hkube:logs:all';
const component = components.GRAPHQL_QUERIES;

class ErrorLogsQuerier {
    constructor() {
        this._isInit = false;
        this._client = null;
    }

    async init(options) {
        if (!this._isInit) {
            this._client = Factory.getClient(options.redis);
            this._isInit = true;
            log.info('redis for logs queries initiated', { component });
        }
    }

    async getLogs(start = 0, end = 99) {
        try {
            const logs = await this._client.lrange(LOGS_PREFIX, start, end) || [];
            const msgs = logs.map(l => JSON.parse(l));
            return msgs;
        }
        catch (error) {
            log.error(`unable to get logs from redis ${error}`, { component }, error);
            return [];
        }
    }

    async deleteLogs() {
        try {
            const res = await this._client.del(LOGS_PREFIX);
            return res;
        }
        catch (error) {
            log.error(`unable to delete logs ${error}`, { component }, error);
            return 0;
        }
    }
}

module.exports = new ErrorLogsQuerier();
