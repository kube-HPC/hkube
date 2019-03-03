const EventEmitter = require('events');
const isEqual = require('lodash.isequal');
const Etcd = require('@hkube/etcd');
const { JobResult, JobStatus } = require('@hkube/etcd');
const storageManager = require('@hkube/storage-manager');
const DriverStates = require('./DriverStates');

const CompletedState = [DriverStates.COMPLETED, DriverStates.FAILED, DriverStates.STOPPED];

class StateManager extends EventEmitter {
    constructor(option) {
        super();
        const options = option || {};
        this.setJobStatus = this.setJobStatus.bind(this);
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        this._podName = options.podName;
        this._lastDiscovery = null;
        this._etcd.discovery.register({ data: this._defaultDiscovery() });
        this._discoveryMethod = options.discoveryMethod || function noop() { };
        this._subscribe();
        this._watchDrivers();
    }

    _subscribe() {
        this._etcd.tasks.on('change', (data) => {
            this.emit(`task-${data.status}`, data);
        });
        this._etcd.jobState.on('change', (data) => {
            this.emit(`job-${data.state}`, data);
        });
        this._etcd.drivers.on('change', (data) => {
            this.emit(data.status.command, data);
        });
    }

    _defaultDiscovery(discovery) {
        const data = {
            paused: false,
            driverStatus: DriverStates.READY,
            jobStatus: DriverStates.READY,
            podName: this._podName,
            ...discovery
        };
        return data;
    }

    _updateDiscovery() {
        const discovery = this._discoveryMethod();
        const currentDiscovery = this._defaultDiscovery(discovery);
        if (!isEqual(this._lastDiscovery, currentDiscovery)) {
            this._lastDiscovery = currentDiscovery;
            return this._etcd.discovery.updateRegisteredData(currentDiscovery);
        }
        return null;
    }

    isCompletedState(job) {
        return job && CompletedState.includes(job.status);
    }

    async setJobResults(options) {
        let error;
        try {
            let results;
            if (options.data) {
                const data = await Promise.all(options.data.map(async (a) => {
                    if (a.result && a.result.storageInfo) {
                        const result = await storageManager.get(a.result.storageInfo);
                        return { ...a, result };
                    }
                    return a;
                }));
                const storageInfo = await storageManager.hkubeResults.put({ jobId: options.jobId, data });
                results = { storageInfo };
            }
            await this._etcd.jobResults.set({ jobId: options.jobId, data: new JobResult({ ...options, data: results }) });
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
        return this._etcd.jobStatus.set({ jobId: options.jobId, data: new JobStatus(options) });
    }

    getJobStatus(options) {
        return this._etcd.jobStatus.get({ jobId: options.jobId });
    }

    tasksList(options) {
        return this._etcd.tasks.list(options);
    }

    getExecution(options) {
        return this._etcd.runningPipelines.get(options);
    }

    setExecution(options) {
        return this._etcd.runningPipelines.set(options);
    }

    watchTasks(options) {
        return this._etcd.tasks.watch(options);
    }

    unWatchTasks(options) {
        return this._etcd.tasks.unwatch(options);
    }

    deleteTasksList(options) {
        return this._etcd.tasks.delete(options);
    }

    stopJob(options) {
        return this._etcd.jobState.stop(options);
    }

    watchJobState(options) {
        return this._etcd.jobState.watch(options);
    }

    unWatchJobState(options) {
        return this._etcd.jobState.unwatch(options);
    }

    _watchDrivers() {
        return this._etcd.drivers.watch({ driverId: this._etcd.discovery._instanceId });
    }
}

module.exports = StateManager;
