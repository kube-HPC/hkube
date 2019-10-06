const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const Etcd = require('@hkube/etcd');
const { tracer } = require('@hkube/metrics');
const storageManager = require('@hkube/storage-manager');
const DriverStates = require('./DriverStates');

const CompletedState = [DriverStates.COMPLETED, DriverStates.FAILED, DriverStates.STOPPED];

class StateManager extends EventEmitter {
    constructor(option) {
        super();
        const options = option || {};
        this.setJobStatus = this.setJobStatus.bind(this);
        this._etcd = new Etcd({ ...options.etcd, serviceName: options.serviceName });
        this._podName = options.podName;
        this._lastDiscovery = null;
        this._driverId = this._etcd.discovery._instanceId;
        this._etcd.discovery.register({ data: this._defaultDiscovery() });
        this._discoveryMethod = options.discoveryMethod || function noop() { };
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

    async setJobResults(options) {
        let error;
        let parent;
        const topSpan = tracer.topSpan(options.jobId);
        if (topSpan) {
            parent = topSpan.context();
        }
        const span = tracer.startSpan({ name: 'set job result', parent, tags: { jobId: options.jobId } });
        try {
            let results;
            if (options.data) {
                const startSpan = tracer.startSpan.bind(tracer, { name: 'storage-get', parent: span.context() });
                const data = await Promise.all(options.data.map(async (a) => {
                    if (a.result && a.result.storageInfo) {
                        const result = await storageManager.get(a.result.storageInfo, startSpan);
                        return { ...a, result };
                    }
                    return a;
                }));
                const storageInfo = await storageManager.hkubeResults.put({ jobId: options.jobId, data }, tracer.startSpan.bind(tracer, { name: 'storage-put', parent: span.context() }));
                results = { storageInfo };
            }
            await this._etcd.jobs.results.set({ jobId: options.jobId, ...options, data: results });
            span.finish();
        }
        catch (e) {
            error = e.message;
            span.finish(e);
        }
        return error;
    }

    async updateDiscovery() {
        return this._updateDiscovery();
    }

    async setJobStatus(options) {
        await this._updateDiscovery();
        return this._etcd.jobs.status.update(options, s => s.status !== DriverStates.STOPPED);
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

    watchTasks(options) {
        return this._etcd.jobs.tasks.watch(options);
    }

    unWatchTasks(options) {
        return this._etcd.jobs.tasks.unwatch(options);
    }

    deleteTasksList(options) {
        return this._etcd.jobs.tasks.delete(options, { isPrefix: true });
    }

    stopJob(options) {
        return this._etcd.jobs.status.set({ jobId: options.jobId, status: DriverStates.STOPPED });
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
