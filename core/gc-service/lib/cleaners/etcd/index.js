const etcdStore = require('../../helpers/etcd');
const { isTimeBefore } = require('../../utils/time');
const tryParseJson = require('../../utils/tryParseJson');
const BaseCleaner = require('../../core/base-cleaner');

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

class EtcdCleaner extends BaseCleaner {
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
                if (canDelete && isTimeBefore(timestamp, maxAgeResolved)) {
                    keys.push(k);
                }
            });
        });
        return keys;
    }

    async delete(data) {
        await Promise.all(data.map(k => etcdStore.deleteKey(k)));
    }
}

module.exports = EtcdCleaner;
