/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const storageManager = require('@hkube/storage-manager');
const { tracer } = require('@hkube/metrics');
const logger = require('@hkube/logger');
let log;
const component = require('../consts/componentNames').STATE_MANAGER;

class StateManager extends EventEmitter {
    constructor() {
        super();
        this._failedHealthcheckCount = 0;
    }

    async init(options) {
        log = logger.GetLogFromContainer();
        this._options = options;
        const etcd = new Etcd(options.etcd);
        Object.assign(this, etcd);
        await this._watch();
        await this.discovery.register({ serviceName: options.serviceName, data: options });
        this._healthcheck();
    }

    checkHealth(maxFailed) {
        return this._failedHealthcheckCount < maxFailed;
    }

    _healthcheck() {
        if (this._options.healthchecks.checkInterval) {
            setTimeout(() => {
                this._healthcheckInterval();
            }, this._options.healthchecks.checkInterval);
        }
    }

    async _healthcheckInterval() {
        try {
            const running = await this.jobs.active.list();
            const jobIds = running.map(r => r.jobId);
            const completedToDelete = [];
            for (const jobId of jobIds) {
                const result = await this.jobs.results.get({ jobId });
                if (result) {
                    const age = Date.now() - new Date(result.timestamp);
                    if (age > this._options.healthchecks.minAge) {
                        completedToDelete.push(result);
                    }
                }
            }
            if (completedToDelete.length) {
                log.info(`found ${completedToDelete.length} completed jobs`, { component });
                this._failedHealthcheckCount += 1;
            }
            for (const result of completedToDelete) {
                this.emit('job-result-change', result);
            }
        }
        catch (error) {
            log.throttle.warning(`Failed to run healthchecks: ${error.message}`, { component });
        }
        this._healthcheck();
    }

    async _watch() {
        await this.algorithms.builds.watch();
        await this.jobs.results.watch();
        await this.jobs.status.watch();
        this.jobs.results.on('change', result => {
            this.emit('job-result-change', result);
            this._failedHealthcheckCount = 0;
        });
    }

    async getJobResult(options) {
        const result = await this.jobs.results.get(options);
        return this.getResultFromStorage(result);
    }

    async getJobResults(options) {
        const list = await this.jobs.results.list(options);
        return Promise.all(list.map(r => this.getResultFromStorage(r)));
    }

    async getResultFromStorage(options) {
        if (options && options.data && options.data.storageInfo) {
            try {
                const data = await storageManager.get(options.data.storageInfo, tracer.startSpan.bind(tracer, { name: 'storage-get-result' }));
                return { ...options, data, storageModule: storageManager.moduleName };
            }
            catch (error) {
                return { error: new Error(`failed to get from storage: ${error.message}`) };
            }
        }
        return options;
    }
}

module.exports = new StateManager();
