const { CronJob } = require('cron');
const cronstrue = require('cronstrue');
const log = require('@hkube/logger').GetLogFromContainer();
const { formatDate } = require('../utils/time');

class BaseCleaner {
    constructor({ config, name, options }) {
        this._name = name;
        this._cron = config.cron;
        this._healthCheckMaxDiff = options.healthchecks.maxDiff;
        this._enabled = config.enabled;
        this._config = config.settings;
        this._lastCronStartTime = null;
        this._lastCronEndTime = null;
        this._isHealthy = true;
        this._working = false;
    }

    get enabled() {
        return this._enabled;
    }

    start() {
        this._cronJob = new CronJob({
            cronTime: this._cron,
            onTick: (cb) => this._cronStart(cb),
            onComplete: () => this._cronEnd(),
            start: true,
            runOnInit: true
        });
    }

    async _cronStart(cb) {
        log.debug(`starting cleaner ${this._name}`);
        if (this._working) {
            return;
        }
        try {
            this._working = true;
            if (!this._error) {
                this._lastCronStartTime = Date.now();
            }
            await this.clean(this._config);
            this._lastCronEndTime = Date.now();
            this._error = undefined;
        }
        catch (e) {
            this._error = e.message;
            log.throttle.error(`error in ${this._name} cleaner. ${e.message}`, { component: this._name });
        }
        finally {
            cb();
            this._working = false;
        }
    }

    _cronEnd() {
        log.debug(`completed cleaner ${this._name}, next: ${this.nextDate()}`);
    }

    nextDate() {
        return this._cronJob?.nextDate();
    }

    cronFormat() {
        return `${cronstrue.toString(this._cron)} (${this._cron})`;
    }

    getStatus() {
        const status = {
            name: this._name,
            enabled: this._enabled,
            isHealthy: this.isHealthy(),
            error: this._error,
            cron: this._cron,
            cronText: this.cronFormat(),
            cronNextTick: this.nextDate(),
            maxAge: this._config.maxAge,
            lastCronStartTime: formatDate(this._lastCronStartTime) || 'Never',
            lastCronEndTime: formatDate(this._lastCronEndTime) || 'Never',
            totalCleaned: this._totalCleaned || 0
        };
        return status;
    }

    runResult({ count, data, sample }) {
        this._totalCleaned = count;
        return this._runResult({ count, data, sample });
    }

    dryRunResult({ count, data, sample }) {
        return this._runResult({ count, data, sample });
    }

    _runResult({ count, data, sample }) {
        return {
            name: this._name,
            count: count >= 0 ? count : data.length,
            sample: sample || data.slice(0, 10)
        };
    }

    isHealthy() {
        return this._isHealthy;
    }

    checkHealth() {
        if (!this._lastCronStartTime && !this._lastCronEndTime) {
            return;
        }
        const lastCronEndTime = this._lastCronEndTime || Date.now();
        const diff = lastCronEndTime - this._lastCronStartTime;
        const isHealthy = (diff < this._healthCheckMaxDiff);
        if (isHealthy && !this._isHealthy) {
            this._isHealthy = true;
            log.warning(`cleaner ${this._name} is now healthy`);
        }
        if (!isHealthy && this._isHealthy) {
            this._isHealthy = false;
            log.warning(`cleaner ${this._name} is now unhealthy`);
        }
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
