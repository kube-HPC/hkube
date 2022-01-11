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
        const allData = await Promise.all(paths.map(async (path) => {
            let totalData = [];
            let data = [];
            do {
                // eslint-disable-next-line no-await-in-loop
                data = await this.fetch({ maxAge, path });
                // eslint-disable-next-line no-await-in-loop
                await this.delete(data);
                totalData = totalData.concat(data);
            } while (data.length > 0);
            return totalData;
        }));
        let flatData = [];
        allData.forEach(d => {
            flatData = flatData.concat(d);
        });
        return this.runResult({ data: flatData });
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        return this.dryRunResult({ data });
    }

    async fetch({ maxAge, path } = {}) {
        const maxAgeResolved = this.resolveMaxAge(maxAge, this._config.maxAge);
        const keys = [];
        const data = await etcdStore.getKeys(path);
        Object.entries(data).forEach(([k, v]) => {
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
        return keys;
    }

    async delete(data) {
        await Promise.all(data.map(k => etcdStore.deleteKey(k)));
    }
}

module.exports = EtcdCleaner;
