const EventEmitter = require('events');
const { JobResult, JobStatus } = require('@hkube/etcd');
const StateFactory = require('./state-factory');
const StorageFactory = require('../datastore/storage-factory');

class StateManager extends EventEmitter {
    constructor() {
        super();
        this._handleEvent = this._handleEvent.bind(this);
        this.setJobStatus = this.setJobStatus.bind(this);
        this._etcd = StateFactory.getClient();
        this._storageAdapter = StorageFactory.getAdapter();
        StateFactory.on('event', this._handleEvent);
    }

    _handleEvent(event) {
        this.emit(event.name, event.data);
    }

    clean() {
        StateFactory.removeListener('event', this._handleEvent);
    }

    async getTaskState(options) {
        return this._etcd.services.pipelineDriver.getTaskState({ jobId: options.jobId, taskId: options.taskId });
    }

    async setTaskState(options) {
        return this._etcd.services.pipelineDriver.setTaskState({ jobId: options.jobId, taskId: options.taskId, data: options.data });
    }

    async getDriverState(options) {
        return this._etcd.services.pipelineDriver.getState(options);
    }

    async setDriverState(options) {
        return this._etcd.services.pipelineDriver.setState({ jobId: options.jobId, data: { state: options.data, startTime: new Date() } });
    }

    async getDriverTasks(options) {
        return this._etcd.services.pipelineDriver.getDriverTasks(options);
    }

    async deleteDriverState(options) {
        return this._etcd.services.pipelineDriver.deleteState(options);
    }

    async setJobResults(options) {
        let storageInfo;
        if (options.data) {
            const data = await Promise.all(options.data.map(async (a) => {
                if (a.result && a.result.storageInfo) {
                    const result = await this._storageAdapter.get(a.result.storageInfo);
                    return { ...a, result };
                }
                return null;
            }));
            storageInfo = await this._storageAdapter.putResults({ jobId: options.jobId, data });
        }
        return this._etcd.jobResults.set({ jobId: options.jobId, data: new JobResult({ ...options, data: { storageInfo } }) });
    }

    async setJobStatus(options) {
        return this._etcd.jobStatus.set({ jobId: options.jobId, data: new JobStatus(options) });
    }

    async getState(options) {
        let result = null;
        const driver = await this.getDriverState(options);
        if (driver) {
            const driverTasks = await this.getDriverTasks(options);
            const jobTasks = await this._etcd.tasks.list(options);
            result = Object.assign({}, driver);
            result.driverTasks = driverTasks || [];
            result.jobTasks = jobTasks || new Map();
        }
        return result;
    }

    async getExecution(options) {
        return this._etcd.execution.get(options);
    }

    async setExecution(options) {
        return this._etcd.execution.set(options);
    }

    async watchTasks(options) {
        return this._etcd.tasks.watch(options);
    }

    async unWatchTasks(options) {
        return this._etcd.tasks.unwatch(options);
    }

    async deleteWorkersState(options) {
        return this._etcd.tasks.delete(options);
    }

    async watchJobState(options) {
        return this._etcd.jobs.watch(options);
    }

    async unWatchJobState(options) {
        return this._etcd.jobs.unwatch(options);
    }
}

module.exports = StateManager;
