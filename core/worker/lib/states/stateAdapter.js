const EventEmitter = require('events');
const asyncQueue = require('async.queue');
const Etcd = require('@hkube/etcd');
const Logger = require('@hkube/logger');
const { cacheResults } = require('../utils');
const { EventMessages, Components, jobStatus } = require('../consts');
const component = Components.ETCD;
let log;

class StateAdapter extends EventEmitter {
    constructor() {
        super();
        this._etcd = null;
    }

    async init(options) {
        if (this._etcd) {
            this._etcd = null;
            this.removeAllListeners();
        }
        if (options.cacheResults.enabled) {
            this.getExistingAlgorithms = cacheResults(this.getExistingAlgorithms.bind(this), options.cacheResults.updateFrequency);
        }
        log = Logger.GetLogFromContainer();
        this._etcd = new Etcd(options.etcd);
        this._workerId = this._etcd.discovery._instanceId;
        this._discoveryInfo = {
            workerId: this._workerId,
            algorithmName: options.jobConsumer.job.type,
            podName: options.kubernetes.pod_name,
            workerImage: options.workerImage,
            algorithmImage: options.algorithmImage
        };
        this._tasksQueue = asyncQueue((task, callback) => {
            this._etcd.jobs.tasks.set(task).then(r => callback(null, r)).catch(e => callback(e));
        }, 1);
        await this._etcd.discovery.register({ data: this._discoveryInfo });
        log.info(`registering worker discovery for id ${this._workerId}`, { component });

        await this.watchWorkerStates();
        this._etcd.workers.on('change', (res) => {
            log.info(`got worker state change ${JSON.stringify(res)}`, { component });
            this.emit(res.status.command, res);
        });
        this.watch({ jobId: 'hookWatch' });

        this._etcd.jobs.status.on('change', (res) => {
            this.emit(res.status, res);
        });
        this._etcd.algorithms.executions.on('change', (res) => {
            this.emit(res.status, res);
        });
        this._etcd.jobs.tasks.on('change', (data) => {
            this.emit(`task-${data.status}`, data);
        });
        this._etcd.jobs.results.on('change', (result) => {
            this._onJobResult(result);
        });
    }

    _onJobResult(result) {
        this.emit(`${EventMessages.JOB_RESULT}-${result.status}`, result);
    }

    async stopAlgorithmExecution(options) {
        return this._etcd.algorithms.executions.set({ ...options, status: jobStatus.STOPPED });
    }

    async watchAlgorithmExecutions(options) {
        return this._etcd.algorithms.executions.watch(options);
    }

    async unwatchAlgorithmExecutions(options) {
        try {
            log.debug('start unwatch algorithm executions', { component });
            await this._etcd.algorithms.executions.unwatch(options);
        }
        catch (error) {
            log.warning(`got error unwatching ${JSON.stringify(options)}. Error: ${error.message}`, { component }, error);
        }
    }

    /**
     * This method watch for job result changes.
     * In case the watch already has job result, we are emit an event
     * on the next tick in order to simulate the regular watch event.
     */
    async watchJobResults(options) {
        const result = await this._etcd.jobs.results.watch(options);
        if (result) {
            setImmediate(() => {
                this._onJobResult(result);
            });
        }
    }

    async unWatchJobResults(options) {
        return this._etcd.jobs.results.unwatch(options);
    }

    async updateDiscovery(options) {
        log.info(`update worker discovery for id ${this._workerId}`, { component });
        await this._etcd.discovery.updateRegisteredData({ ...options, ...this._discoveryInfo });
    }

    updateTask(options) {
        return new Promise((resolve, reject) => {
            this._tasksQueue.push(options, (err, res) => {
                if (err) {
                    return reject(err);
                }
                return resolve(res);
            });
        });
    }

    async watchTasks(options) {
        return this._etcd.jobs.tasks.watch(options);
    }

    async unWatchTasks(options) {
        return this._etcd.jobs.tasks.unwatch(options);
    }

    async watch(options) {
        return this._etcd.jobs.status.watch(options);
    }

    async watchWorkerStates() {
        return this._etcd.workers.watch({ workerId: this._workerId });
    }

    async deleteWorkerState() {
        return this._etcd.workers.delete({ workerId: this._workerId });
    }

    async createAlgorithmType(options) {
        await this._etcd.algorithms.store.set(options);
    }

    async deleteAlgorithmType(options) {
        await this._etcd.algorithms.store.delete(options);
    }

    async getExistingAlgorithms() {
        return this._etcd.algorithms.store.list();
    }

    async unwatch(options) {
        try {
            log.debug('start unwatch', { component });
            await this._etcd.jobs.status.unwatch(options);
            log.debug('end unwatch', { component });
        }
        catch (error) {
            log.warning(`got error unwatching ${JSON.stringify(options)}. Error: ${error.message}`, { component }, error);
        }
    }
}

module.exports = new StateAdapter();
