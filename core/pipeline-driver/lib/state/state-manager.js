const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const Etcd = require('@hkube/etcd');
const logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const db = require('./db');
const DriverStates = require('./DriverStates');
const component = require('../consts/componentNames').STATE_MANAGER;
const CompletedState = [DriverStates.COMPLETED, DriverStates.FAILED, DriverStates.STOPPED, DriverStates.PAUSED];
let log;

class StateManager extends EventEmitter {
    constructor(option) {
        super();
        const options = option || {};
        this._options = options;
        log = logger.GetLogFromContainer();
        this._etcd = new Etcd({ ...options.etcd, serviceName: options.serviceName });
        this._podName = options.kubernetes.podName;
        this._lastDiscovery = null;
        this._driverId = this._etcd.discovery._instanceId;
        this._etcd.discovery.register({ data: this._defaultDiscovery() });
        this._discoveryMethod = options.discoveryMethod || function noop() { };
        this._unScheduledAlgorithmsInterval = options.unScheduledAlgorithms.interval;
        this._subscribe();
        this._watchDrivers();
    }

    _subscribe() {
        this._etcd.jobs.tasks.on('change', (data) => {
            this.emit(`task-${data.status}`, data);
            this.emit('task-changed', data);
        });
        this._etcd.jobs.status.on('change', (data) => {
            this.emit(`job-${data.status}`, data);
        });
        this._etcd.drivers.on('change', (data) => {
            this.emit(data.status.command, data);
        });
    }

    checkUnScheduledAlgorithms() {
        if (this._interval) {
            return;
        }
        this._interval = setInterval(async () => {
            if (this._working) {
                return;
            }
            try {
                this._working = true;
                const resources = await this._etcd.discovery.list({ serviceName: 'task-executor' });
                if (resources && resources[0] && resources[0].unScheduledAlgorithms) {
                    const algorithms = resources[0].unScheduledAlgorithms;
                    Object.values(algorithms).forEach((e) => {
                        this.emit(`events-${e.type}`, e);
                    });
                }
            }
            catch (e) {
                log.throttle.error(e.message, { component });
            }
            finally {
                this._working = false;
            }
        }, this._unScheduledAlgorithmsInterval);
    }

    unCheckUnScheduledAlgorithms() {
        clearInterval(this._interval);
        this._interval = null;
    }

    _defaultDiscovery(discovery) {
        const data = {
            driverId: this._driverId,
            paused: false,
            driverStatus: DriverStates.READY,
            jobStatus: DriverStates.READY,
            podName: this._podName,
            ...discovery
        };
        return data;
    }

    async _updateDiscovery() {
        const discovery = this._discoveryMethod();
        const currentDiscovery = this._defaultDiscovery(discovery);
        if (!isEqual(this._lastDiscovery, currentDiscovery)) {
            this._lastDiscovery = currentDiscovery;
            await this._etcd.discovery.updateRegisteredData(currentDiscovery);
        }
    }

    isCompletedState(job) {
        return job && CompletedState.includes(job.status);
    }

    async setJobResultsToStorage(options) {
        let storageError;
        let storageResults;
        let span;
        try {
            if (options.data) {
                let parent;
                const topSpan = tracer.topSpan(options.jobId);
                if (topSpan) {
                    parent = topSpan.context();
                }
                span = tracer.startSpan({ name: 'set job result', parent, tags: { jobId: options.jobId } });
                const startSpan = tracer.startSpan.bind(tracer, { name: 'storage-get', parent: span.context() });

                const data = await Promise.all(options.data.map(async (a) => {
                    if (a.result && a.result.storageInfo) {
                        let result;
                        let info;
                        let objSize = a.result.storageInfo.size;
                        if (!objSize) {
                            result = await storageManager.getMetadata(a.result.storageInfo, startSpan);
                            objSize = result.size;
                        }
                        const resSize = storageManager.checkDataSize(objSize);
                        if (!resSize.error) {
                            const { payload } = await storageManager.getCustomData(a.result.storageInfo, startSpan);
                            result = payload;
                        }
                        else {
                            info = { ...a.result.storageInfo, isBigData: true, message: resSize.error };
                        }
                        return { ...a, result, info };
                    }
                    return a;
                }));
                this._removeUndefined(data);
                const storageInfo = await storageManager.hkubeResults.put({ jobId: options.jobId, data }, tracer.startSpan.bind(tracer, { name: 'storage-put', parent: span.context() }));
                storageResults = { storageInfo };
            }
        }
        catch (e) {
            storageError = e.message;
        }
        finally {
            span && span.finish(storageError);
        }
        return { storageError, storageResults };
    }

    _removeUndefined(data) {
        data.forEach(d => Object.keys(d).forEach(k => d[k] === undefined && delete d[k]));
    }

    async setJobResults(options) {
        let error;
        try {
            await this._etcd.jobs.results.set(options);
            await db.updateResult(options);
        }
        catch (e) {
            error = e.message;
        }
        return error;
    }

    async updateDiscovery() {
        return this._updateDiscovery();
    }

    async setJobStatus(options) {
        await this._updateDiscovery();
        return this._etcd.jobs.status.update(options, (oldItem) => {
            if (oldItem.status !== DriverStates.STOPPED && oldItem.status !== DriverStates.PAUSED) {
                const data = { ...oldItem, ...options };
                db.updateStatus(data);
                return data;
            }
            return null;
        }).catch(e => {
            log.throttle.warning(`setJobStatus failed with error: ${e.message}`, { component });
        });
    }

    getJobStatus(options) {
        return db.fetchStatus(options);
    }

    async tasksList(options) {
        const list = await this._etcd.jobs.tasks.list({ ...options, limit: 100000 });
        const results = new Map();
        list.forEach((v) => {
            results.set(v.taskId, v);
        });
        return results;
    }

    getExecution(options) {
        return db.fetchPipeline(options);
    }

    updatePipeline(options) {
        return db.updatePipeline(options);
    }

    watchTasks(options) {
        return this._etcd.jobs.tasks.watch(options);
    }

    unWatchTasks(options) {
        return this._etcd.jobs.tasks.unwatch(options);
    }

    deleteTasksList(options) {
        return this._etcd.jobs.tasks.delete(options, { isPrefix: true });
    }

    deleteStreamingStats(options) {
        return this._etcd.streaming.statistics.delete(options, { isPrefix: true });
    }

    watchJobStatus(options) {
        return this._etcd.jobs.status.watch(options);
    }

    unWatchJobStatus(options) {
        return this._etcd.jobs.status.unwatch(options);
    }

    _watchDrivers() {
        return this._etcd.drivers.watch({ driverId: this._driverId });
    }

    async createJob({ jobId, pipeline, status }) {
        await db.createJob({ jobId, pipeline, status });
        await this._etcd.jobs.status.set({ jobId, ...status });
    }
}

module.exports = StateManager;
