const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const moment = require('moment');
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
        this._exitOnEtcdProblemBinded = this._exitOnEtcdProblem.bind(this);
        this._emitter = new EventEmitter();
        this._etcd = new Etcd(options.etcd);
        this._wrapEtcd();
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

    setJobConsumer(jobConsumer) {
        this.jobConsumer = jobConsumer;
    }

    _wrapperForEtcdProblem(fn) {
        // eslint-disable-next-line func-names
        const fnb = fn.bind(this);
        if (fn.constructor.name === 'AsyncFunction') {
            return async (...args) => {
                try {
                    const result = await fnb(...args);
                    return result;
                }
                catch (ex) {
                    this._exitOnEtcdProblemBinded(ex);
                    throw ex;
                }
            };
        }
        return (...args) => {
            try {
                const result = fnb(...args);
                return result;
            }
            catch (ex) {
                this._exitOnEtcdProblemBinded(ex);
                throw ex;
            }
        };
    }

    _wrapEtcd() {
        const wrappedFns = ['updateDiscovery', 'tasksList', 'watchTasks', 'unWatchTasks', 'deleteTasksList', 'deleteStreamingStats', 'watchJobStatus', 'unWatchJobStatus', 'watchDrivers', 'createJob'];
        wrappedFns.forEach(propertyName => {
            if (typeof this[propertyName] === 'function') {
                this[propertyName] = this._wrapperForEtcdProblem(this[propertyName]);
            }
        });
    }

    _wrapJobsService() {
        ['updateResult', 'updateStatus', 'fetchStatus', 'fetchResult', 'updatePipeline', 'createJob'].forEach(propertyName => {
            if (typeof this._db.jobs[propertyName] === 'function') {
                this[propertyName] = this._wrapperForDBProblem(this[propertyName]);
            }
        });
    }

    _wrapperForDBProblem(fn) {
        // eslint-disable-next-line func-names
        const bfn = fn.bind(this);
        if (bfn.constructor.name === 'AsyncFunction') {
            return async (...args) => {
                try {
                    const result = await bfn(...args);
                    return result;
                }
                catch (ex) {
                    this._exitOnDBProblemBinded(ex);
                    throw ex;
                }
            };
        }
        return (...args) => {
            try {
                const result = bfn(...args);
                return result;
            }
            catch (ex) {
                this._exitOnDBProblemBinded(ex);
                throw ex;
            }
        };
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
            this._exitOnEtcdProblem(e);
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
    createJob({ jobId, pipeline, status, graph }) {
        return this._db.jobs.create({ jobId, pipeline, status, graph });
    }

    updateResult(options) {
        return this._db.jobs.updateResult(options);
    }

    fetchStatus({ jobId }) {
        return this._db.jobs.fetchStatus({ jobId });
    }

    fetchResult({ jobId }) {
        return this._db.jobs.fetchResult({ jobId });
    }

    updatePipeline(options) {
        return this._db.jobs.updatePipeline(options);
    }

    isCompletedState(status) {
        return CompletedState.includes(status);
    }

    async _exitOnEtcdProblem(e) {
        if (this._etcd.isFatal(e)) {
            log.error(`ETCD problem ${e.message}`, { component }, e);
            const taskRunners = this.jobConsumer.getTaskRunners();
            await Promise.all(Array.from(taskRunners.values()).map((taskRunner) => {
                return taskRunner.getGraphStore()?.stop();
            }));
            process.exit(1);
        }
    }

    _exitOnDBProblem(error) {
        if (this._db.isFatal(error)) {
            log.error(`db problem + ${error}`, { component }, error);
            process.exit(1);
        }
        return error;
    }

    async setJobResults(options) {
        let error;
        try {
            await this._db.jobs.updateResult(options);
        }
        catch (e) {
            error = e.message;
            this._exitOnEtcdProblem(e);
        }
        return error;
    }

    async setJobStatus(options) {
        try {
            await this._db.jobs.updateStatus(options, true);
        }
        catch (e) {
            log.throttle.warning(`setJobStatus failed with error: ${e.message}`, { component });
            this._exitOnEtcdProblem(e);
        }
    }


    getJob({ jobId }) {
        return this._db.jobs.fetch({ jobId, fields: { status: true, pipeline: true } });
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

    watchJob({ jobId }, cb) {
        return this._db.jobs.watchStatus({ jobId }, cb);
    }

    unWatchJob({ jobId }) {
        return this._db.jobs.unwatchStatus({ jobId });
    }

    updateGraph({ jobId, graph }) {
        return this._db.jobs.updateGraph({ jobId, graph: { jobId, timestamp: Date.now(), ...graph } });
    }

    getGraph({ jobId }) {
        return this._db.jobs.fetchGraph({ jobId });
    }

    // Tasks
    createTasks(tasks) {
        return this._db.tasks.createMany(tasks);
    }

    createTask({ jobId, taskId, status }) {
        return this._db.tasks.create({ jobId, taskId, status });
    }

    updateTask({ jobId, taskId, status, error, result, nodeName, batchIndex, metricsPath }) {
        return this._db.tasks.update({ jobId, taskId, status, error, result, nodeName, batchIndex, metricsPath });
    }

    watchTasks({ jobId }, cb) {
        return this._db.tasks.watch({ jobId }, cb);
    }

    unWatchTasks({ jobId }) {
        return this._db.tasks.unwatch({ jobId });
    }

    getTasks({ jobId }) {
        return this._db.tasks.search({ jobId });
    }
}

module.exports = new StateManager();
