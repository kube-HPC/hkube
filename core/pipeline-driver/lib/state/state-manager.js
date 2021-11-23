const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const Etcd = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const log = require('@hkube/logger').GetLogFromContainer();
const { tracer } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const commands = require('../consts/commands');
const DriverStates = require('./DriverStates');
const component = require('../consts/componentNames').STATE_MANAGER;
const CompletedState = [DriverStates.COMPLETED, DriverStates.FAILED, DriverStates.STOPPED, DriverStates.PAUSED];

class StateManager {
    async init(options) {
        this._emitter = new EventEmitter();
        this._etcd = new Etcd(options.etcd);
        this._podName = options.kubernetes.podName;
        this._lastDiscovery = null;
        this._driverId = this._etcd.discovery._instanceId;
        this._etcd.discovery.register({ data: this._defaultDiscovery() });
        this._unScheduledAlgorithmsInterval = options.unScheduledAlgorithms.interval;
        this._watchDrivers();

        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    // Discovery
    onStopProcessing(func) {
        this._etcd.drivers.on('change', (data) => {
            if (data.status.command === commands.stopProcessing) {
                func(data);
            }
        });
    }

    onUnScheduledAlgorithms(func) {
        this._emitter.on('events-warning', (data) => {
            func(data);
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
                        this._emitter.emit(`events-${e.type}`, e);
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
            podName: this._podName,
            idle: true,
            paused: false,
            status: DriverStates.READY,
            jobs: [],
            ...discovery
        };
        return data;
    }

    async updateDiscovery(discovery) {
        const currentDiscovery = this._defaultDiscovery(discovery);
        if (!isEqual(this._lastDiscovery, currentDiscovery)) {
            this._lastDiscovery = currentDiscovery;
            await this._etcd.discovery.updateRegisteredData(currentDiscovery);
        }
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

    deleteStreamingStats(options) {
        return this._etcd.streaming.statistics.delete(options, { isPrefix: true });
    }

    _watchDrivers() {
        return this._etcd.drivers.watch({ driverId: this._driverId });
    }

    // Jobs
    createJob({ jobId, pipeline, status }) {
        return this._db.jobs.create({ jobId, pipeline, status });
    }

    updateResult(options) {
        return this._db.jobs.updateResult(options);
    }

    updateStatus(options, updateOnlyActive) {
        return this._db.jobs.updateStatus(options, updateOnlyActive);
    }

    fetchStatus(options) {
        return this._db.jobs.fetchStatus(options);
    }

    updatePipeline(options) {
        return this._db.jobs.updatePipeline(options);
    }

    isCompletedState(job) {
        return job && CompletedState.includes(job.status);
    }

    getJobStatus(options) {
        return this._db.fetchStatus(options);
    }

    async setJobResults(options) {
        let error;
        try {
            await this._db.jobs.updateResult(options);
        }
        catch (e) {
            error = e.message;
        }
        return error;
    }

    async setJobStatus(options) {
        try {
            await this._db.jobs.updateStatus(options, true);
        }
        catch (e) {
            log.throttle.warning(`setJobStatus failed with error: ${e.message}`, { component });
        }
    }

    getJob({ jobId }) {
        return this._db.jobs.fetch({ jobId, fields: { status: true, pipeline: true } });
    }

    watchJob({ jobId }, cb) {
        return this._db.jobs.watchStatus({ jobId }, cb);
    }

    unWatchJob({ jobId }) {
        return this._db.jobs.unwatchStatus({ jobId });
    }

    // Graph
    updateGraph({ jobId, graph }) {
        return this._db.jobs.updateGraph({ jobId, graph: { jobId, timestamp: Date.now(), ...graph } });
    }

    async getGraph({ jobId }) {
        const res = await this._db.jobs.fetchGraph({ jobId });
        if (!res) {
            return null;
        }
        if (Object.keys(res).length === 1 && res.jobId) {
            return null;
        }
        return res;
    }

    // Tasks
    createTasks(tasks) {
        return this._db.tasks.createMany(tasks);
    }

    watchTasks({ jobId }, cb) {
        return this._db.tasks.watch({ jobId }, cb);
    }

    unWatchTasks({ jobId }) {
        return this._db.tasks.unwatch({ jobId });
    }

    async getTasks({ jobId }) {
        const list = await this._db.tasks.search({ jobId });
        const results = new Map();
        list.forEach((v) => {
            results.set(v.taskId, v);
        });
        return results;
    }
}

module.exports = new StateManager();
