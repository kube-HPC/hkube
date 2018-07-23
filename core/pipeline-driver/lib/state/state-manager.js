const EventEmitter = require('events');
const { JobResult, JobStatus } = require('@hkube/etcd');
const stateFactory = require('./state-factory');
const StorageFactory = require('../datastore/storage-factory');

class StateManager extends EventEmitter {
    constructor(options) {
        super();
        options = options || {};
        this._handleEvent = this._handleEvent.bind(this);
        this.setJobStatus = this.setJobStatus.bind(this);
        this._etcd = stateFactory.getClient();
        this._storageAdapter = StorageFactory.getAdapter();
        stateFactory.methods({ discoveryMethod: options.discoveryMethod });
        stateFactory.on('event', this._handleEvent);
    }

    _handleEvent(event) {
        this.emit(event.name, event.data);
    }

    clean() {
        stateFactory.removeListener('event', this._handleEvent);
    }

    getTaskState(options) {
        return this._etcd.services.pipelineDriver.getTaskState({ jobId: options.jobId, taskId: options.taskId });
    }

    setTaskState(options) {
        return this._etcd.services.pipelineDriver.setTaskState({ jobId: options.jobId, taskId: options.taskId, data: options.data });
    }

    getDriverState(options) {
        return this._etcd.services.pipelineDriver.getState(options);
    }

    setDriverState(options) {
        return this._etcd.services.pipelineDriver.setState({ jobId: options.jobId, data: { state: options.data, startTime: new Date() } });
    }

    getDriverTasks(options) {
        return this._etcd.services.pipelineDriver.getDriverTasks(options);
    }

    deleteDriverState(options) {
        return this._etcd.services.pipelineDriver.deleteState(options);
    }

    async setJobResults(options) {
        let results;
        if (options.data) {
            const data = await Promise.all(options.data.map(async (a) => {
                if (a.result && a.result.storageInfo) {
                    const result = await this._storageAdapter.get(a.result.storageInfo);
                    return { ...a, result };
                }
                return a;
            }));
            const storageInfo = await this._storageAdapter.putResults({ jobId: options.jobId, data });
            results = { storageInfo };
        }
        return this._etcd.jobResults.set({ jobId: options.jobId, data: new JobResult({ ...options, data: results }) });
    }

    setJobStatus(options) {
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

    getExecution(options) {
        return this._etcd.execution.get(options);
    }

    setExecution(options) {
        return this._etcd.execution.set(options);
    }

    watchTasks(options) {
        return this._etcd.tasks.watch(options);
    }

    unWatchTasks(options) {
        return this._etcd.tasks.unwatch(options);
    }

    deleteWorkersState(options) {
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
}

module.exports = StateManager;
