const { CronJob } = require('cron');
const cronstrue = require('cronstrue');
const log = require('@hkube/logger').GetLogFromContainer();
const { formatDate } = require('../utils/time');

class BaseCleaner {
    constructor({ config, name }) {
        this._name = name;
        this._cron = config.cron;
        this._config = config.settings;
        this._lastIntervalTime = Date.now();
    }

    init({ cleanMethod }) {
        this._cronJob = new CronJob(this._cron, async (cb) => {
            log.debug(`starting cleaner ${this._name}`);
            try {
                await cleanMethod(this._config);
            }
            catch (e) {
                log.throttle.error(e.message, { component: this._name });
            }
            finally {
                cb();
            }
        }, () => {
            log.debug(`completed cleaner ${this._name}, next: ${this._cronJob.nextDate()}`);
        });
    }

    nextDate() {
        return this._cronJob.nextDate();
    }

    start() {
        this._cronJob.start();
    }

    setResultCount(count) {
        this._totalCleaned = count;
        this._lastIntervalTime = Date.now();
    }

    getStatus() {
        const status = {
            name: this._name,
            cron: this._cron,
            cronText: cronstrue.toString(this._cron),
            nextTick: this._cronJob.nextDate(),
            maxAge: this._config.maxAge,
            lastClean: formatDate(this._lastIntervalTime) || 'Never',
            totalCleaned: this._totalCleaned || 0
        };
        return status;
    }

    dryRunResult(data) {
        return {
            name: this._name,
            count: data.length,
            exampleKeys: data.slice(0, 10)
        };
    }

    checkHealth(maxDiff) {
        const diff = Date.now() - this._lastIntervalTime;
        return (diff < maxDiff);
    }

    resolveMaxAge(maxAge, configMaxAge) {
        if (maxAge >= 0) {
            return maxAge;
        }
        if (configMaxAge >= 0) {
            return configMaxAge;
        }
        throw new Error('maxAge must be a valid positive integer');
    }
}

module.exports = BaseCleaner;
