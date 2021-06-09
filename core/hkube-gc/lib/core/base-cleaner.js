const { CronJob } = require('cron');
const cronstrue = require('cronstrue');
const log = require('@hkube/logger').GetLogFromContainer();
const { formatDate } = require('../utils/time');

class BaseCleaner {
    constructor({ config, name }) {
        this._name = name;
        this._cron = config.cron;
        this._config = config.settings;
        this._lastStartTime = null;
        this._lastEndTime = null;
    }

    nextDate() {
        return this._cronJob.nextDate();
    }

    start() {
        this._cronJob = new CronJob(this._cron, async (cb) => {
            log.debug(`starting cleaner ${this._name}`);
            try {
                this._lastStartTime = Date.now();
                await this.clean(this._config);
                this._lastEndTime = Date.now();
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
        this._cronJob.start();
    }

    setResultCount(count) {
        this._totalCleaned = count;
    }

    getStatus() {
        const status = {
            name: this._name,
            cron: this._cron,
            cronText: cronstrue.toString(this._cron),
            nextTick: this._cronJob.nextDate(),
            maxAge: this._config.maxAge,
            lastCleanStartTime: formatDate(this._lastStartTime) || 'Never',
            lastCleanEndTime: formatDate(this._lastEndTime) || 'Never',
            totalCleaned: this._totalCleaned || 0
        };
        return status;
    }

    dryRunResult(data) {
        return {
            name: this._name,
            count: data.length,
            sample: data.slice(0, 10)
        };
    }

    isHealthy(maxDiff) {
        if (!this._lastStartTime && !this._lastEndTime) {
            return true;
        }

        let lastEndTime = this._lastEndTime;
        if (this._lastStartTime && !this._lastEndTime) {
            lastEndTime = Date.now();
        }
        const diff = lastEndTime - this._lastStartTime;
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
