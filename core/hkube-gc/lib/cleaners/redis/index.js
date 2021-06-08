const redisStore = require('../../helpers/redis');
const { shouldDelete } = require('../../utils/time');
const BaseCleaner = require('../../core/base-cleaner');

const paths = [
    '/hkube:pipeline:graph',
    '/pipeline-driver/graph',
    '/pipeline-driver/nodes-graph'
];

class Cleaner extends BaseCleaner {
    async clean({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        await Promise.all(data.map(k => redisStore.deleteKey(k)));
        this.setResultCount(data.length);
        return this.getStatus();
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        return this.dryRunResult(data);
    }

    async fetch({ maxAge } = {}) {
        const maxJobAge = this.resolveMaxAge(maxAge, this._config.maxAge);
        const keys = [];
        for (const path of paths) { // eslint-disable-line
            for await (const data of redisStore.getKeys(`${path}/*`)) { // eslint-disable-line
                Object.entries(data).forEach(([k, v]) => {
                    const timestamp = (v.graph && v.graph.timestamp) || v.timestamp || 0;
                    if (shouldDelete(timestamp, maxJobAge)) {
                        keys.push(k);
                    }
                });
            }
        }
        return keys;
    }
}

module.exports = Cleaner;
