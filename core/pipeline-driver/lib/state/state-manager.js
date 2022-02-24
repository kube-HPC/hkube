const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const moment = require('moment');
const Etcd = require('@hkube/etcd');
const log = require('@hkube/logger').GetLogFromContainer();
const { tracer } = require('@hkube/metrics');
const { pipelineStatuses } = require('@hkube/consts');
const storageManager = require('@hkube/storage-manager');
const { GRPCGenericError, EtcdError } = require('@hkube/etcd/node_modules/etcd3');
const commands = require('../consts/commands');
const db = require('./db');
const DriverStates = require('./DriverStates');
const component = require('../consts/componentNames').STATE_MANAGER;
const CompletedState = [DriverStates.COMPLETED, DriverStates.FAILED, DriverStates.STOPPED, DriverStates.PAUSED];

class StateManager {
    init(options) {
        this._emitter = new EventEmitter();
        this._etcd = new Etcd(options.etcd);
        this._podName = options.kubernetes.podName;
        this._lastDiscovery = null;
        this._driverId = this._etcd.discovery._instanceId;
        this._etcd.discovery.register({ data: this._defaultDiscovery() });
        this._unScheduledAlgorithmsInterval = options.unScheduledAlgorithms.interval;
        this._subscribe();
        this._watchDrivers();
    }

    _subscribe() {
        this._etcd.jobs.status.on('change', (data) => {
            this._emitter.emit(`job-${data.status}`, data);
        });
    }

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

    onJobStop(func) {
        this._emitter.on(`job-${pipelineStatuses.STOPPED}`, (data) => {
            func(data);
        });
    }

    onJobPause(func) {
        this._emitter.on(`job-${pipelineStatuses.PAUSED}`, (data) => {
            func(data);
        });
    }

    onTaskStatus(func) {
        this._etcd.jobs.tasks.on('change', (data) => {
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
                this._exitOnEtcdProblem(e);
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

    // TODO: Handle UI to support driver to many jobs
    async updateDiscovery(discovery) {
        const currentDiscovery = this._defaultDiscovery(discovery);
        if (!isEqual(this._lastDiscovery, currentDiscovery)) {
            this._lastDiscovery = currentDiscovery;
            try {
                await this._etcd.discovery.updateRegisteredData(currentDiscovery);
            }
            catch (e) {
                this._exitOnEtcdProblem(e);
                throw e;
            }
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

    _exitOnEtcdProblem(e) {
        if (e instanceof GRPCGenericError || e instanceof EtcdError) {
            log.error(`ETCD unreachable ${e}`);
            process.exit(1);
        }
    }

    async setJobResults(options) {
        let error;
        try {
            await this._etcd.jobs.results.set(options);
            await db.updateResult(options);
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            error = e.message;
        }
        return error;
    }

    async setJobStatus(options) {
        return this._etcd.jobs.status.update(options, async (oldItem) => {
            if (this._isActiveStatus(oldItem.status)) {
                const data = { ...oldItem, ...options };
                await db.updateStatus(data, true);
                return data;
            }
            return null;
        }).catch(e => {
            log.throttle.warning(`setJobStatus failed with error: ${e.message}`, { component });
            this._exitOnEtcdProblem(e);
        });
    }

    calcTimeTook({ activeTime, startTime } = {}) {
        const now = moment(Date.now());
        const times = {};
        if (activeTime) {
            times.netTimeTook = now.diff(moment(activeTime), 'seconds', true);
        }
        if (startTime) {
            times.grossTimeTook = now.diff(moment(startTime), 'seconds', true);
        }
        return times;
    }

    _isActiveStatus(status) {
        return status !== DriverStates.STOPPED && status !== DriverStates.PAUSED;
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
        try {
            return this._etcd.jobs.tasks.watch(options);
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            throw e;
        }
    }

    unWatchTasks(options) {
        try {
            return this._etcd.jobs.tasks.unwatch(options);
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            throw e;
        }
    }

    deleteTasksList(options) {
        try {
            return this._etcd.jobs.tasks.delete(options, { isPrefix: true });
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            throw e;
        }
    }

    deleteStreamingStats(options) {
        try {
            return this._etcd.streaming.statistics.delete(options, { isPrefix: true });
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            throw e;
        }
    }

    watchJobStatus(options) {
        try {
            return this._etcd.jobs.status.watch(options);
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            throw e;
        }
    }

    unWatchJobStatus(options) {
        try {
            return this._etcd.jobs.status.unwatch(options);
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            throw e;
        }
    }

    _watchDrivers() {
        try {
            return this._etcd.drivers.watch({ driverId: this._driverId });
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            throw e;
        }
    }

    async createJob({ jobId, pipeline, status }) {
        await db.createJob({ jobId, pipeline, status });
        try {
            await this._etcd.jobs.status.set({ jobId, ...status });
        }
        catch (e) {
            this._exitOnEtcdProblem(e);
            throw e;
        }
    }
}

module.exports = new StateManager();
