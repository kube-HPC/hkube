const redisStore = require('../../helpers/redis');
const { isTimeBefore } = require('../../utils/time');
const BaseCleaner = require('../../core/base-cleaner');

const paths = [
    '/hkube:pipeline:graph',
    '/pipeline-driver/graph',
    '/pipeline-driver/nodes-graph'
];

class RedisCleaner extends BaseCleaner {
    async clean({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        await this.delete(data);
        return this.runResult({ data });
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        return this.dryRunResult({ data });
    }

    async fetch({ maxAge } = {}) {
        const maxJobAge = this.resolveMaxAge(maxAge, this._config.maxAge);
        const keys = [];
        for (const path of paths) { // eslint-disable-line
            for await (const data of redisStore.getKeys(`${path}/*`)) { // eslint-disable-line
                Object.entries(data).forEach(([k, v]) => {
                    const timestamp = (v.graph && v.graph.timestamp) || v.timestamp || 0;
                    if (isTimeBefore(timestamp, maxJobAge)) {
                        keys.push(k);
                    }
                });
            }
        }
        return keys;
    }

    async delete(data) {
        await Promise.all(data.map(k => redisStore.deleteKey(k)));
    }
}

module.exports = RedisCleaner;
