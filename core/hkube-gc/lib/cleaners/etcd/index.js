const etcdStore = require('../../utils/etcd');
const { time } = require('../../helpers');
const tryParseJson = require('../../helpers/tryParseJson');
const BaseCleaner = require('../../baseCleaner');

const COMPLETED_JOB_STATUS = [
    'completed',
    'failed',
    'stopped',
];

const paths = [
    '/webhooks',
    '/jobs/status',
    '/jobs/results',
    '/jobs/tasks',
    '/workers',
    '/drivers',
    '/executions',
    '/events',
    '/algorithmQueues',
    '/algorithms/queue',
    '/algorithms/builds',
    '/algorithms/executions',
    '/streaming/statistics'
];

class Cleaner extends BaseCleaner {
    async clean({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        await Promise.all(data.map(k => etcdStore.deleteKey(k)));
        this.setResultCount(data.length);
        return this.getStatus();
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        return this.dryRunResult(data);
    }

    async fetch({ maxAge } = {}) {
        const maxAgeResolved = this.resolveMaxAge(maxAge, this._config.maxAge);
        const keys = [];
        const data = await Promise.all(paths.map(p => etcdStore.getKeys(p)));
        data.forEach((d) => {
            Object.entries(d).forEach(([k, v]) => {
                const obj = tryParseJson(v);
                const timestamp = obj.timestamp || obj.startTime || obj.endTime || 0;
                let canDelete = true;
                if (k.startsWith('/jobs/status') && !COMPLETED_JOB_STATUS.includes(obj.status)) {
                    canDelete = false;
                }
                if (canDelete && time.shouldDelete(timestamp, maxAgeResolved)) {
                    keys.push(k);
                }
            });
        });
        return keys;
    }
}

module.exports = Cleaner;
