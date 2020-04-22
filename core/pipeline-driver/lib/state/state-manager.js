const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const Etcd = require('@hkube/etcd');
const prettyBytes = require('pretty-bytes');
const unitsConverter = require('@hkube/units-converter');
const { tracer } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const DriverStates = require('./DriverStates');

const CompletedState = [DriverStates.COMPLETED, DriverStates.FAILED, DriverStates.STOPPED, DriverStates.PAUSED];

class StateManager extends EventEmitter {
    constructor(option) {
        super();
        const options = option || {};
        this.setJobStatus = this.setJobStatus.bind(this);
        this._etcd = new Etcd({ ...options.etcd, serviceName: options.serviceName });
        this._podName = options.kubernetes.podName;
        this._lastDiscovery = null;
        this._driverId = this._etcd.discovery._instanceId;
        this._etcd.discovery.register({ data: this._defaultDiscovery() });
        this._discoveryMethod = options.discoveryMethod || function noop() { };
        this._storageResultsThreshold = unitsConverter.getMemoryInBytes(options.storageResultsThreshold);
        this._useStorageMetadata = options.useStorageMetadata;
        this._subscribe();
        this._watchDrivers();
    }

    _subscribe() {
        this._etcd.jobs.tasks.on('change', (data) => {
            this.emit(`task-${data.status}`, data);
            this.emit('task-*', data);
        });
        this._etcd.jobs.status.on('change', (data) => {
            this.emit(`job-${data.status}`, data);
        });
        this._etcd.drivers.on('change', (data) => {
            this.emit(data.status.command, data);
        });
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
                        if (!objSize && this._useStorageMetadata) {
                            result = await storageManager.getMetadata(a.result.storageInfo, startSpan);
                            objSize = result.size;
                        }
                        if (objSize < this._storageResultsThreshold) {
                            result = await storageManager.get(a.result.storageInfo, startSpan, { customEncode: true });
                        }
                        else {
                            const message = `data too large (${prettyBytes(objSize)}), use the stream api`;
                            info = { ...a.result.storageInfo, message };
                        }
                        return { ...a, result, info };
                    }
                    return a;
                }));
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

    async setJobResults(options) {
        let error;
        try {
            await this._etcd.jobs.results.set(options);
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
                return { ...oldItem, ...options };
            }
            return null;
        });
    }

    getJobStatus(options) {
        return this._etcd.jobs.status.get(options);
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
        return this._etcd.executions.running.get(options);
    }

    setExecution(options) {
        return this._etcd.executions.running.set(options);
    }

    updateExecution(options, cb) {
        return this._etcd.executions.stored.update(options, cb);
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

    watchJobStatus(options) {
        return this._etcd.jobs.status.watch(options);
    }

    unWatchJobStatus(options) {
        return this._etcd.jobs.status.unwatch(options);
    }

    _watchDrivers() {
        return this._etcd.drivers.watch({ driverId: this._driverId });
    }

    _getTracer(jobId, name) {
        const parent = tracer.topSpan(jobId);
        if (parent) {
            return tracer.startSpan.bind(tracer, { name, parent: parent.context() });
        }
        return null;
    }
}

module.exports = StateManager;
