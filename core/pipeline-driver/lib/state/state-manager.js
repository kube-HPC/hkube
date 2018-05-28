const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const { JobResult, JobStatus } = require('@hkube/etcd');
const DatastoreFactory = require('../datastore/storage-factory');

class StateManager extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        this._storageAdapter = await DatastoreFactory.getAdapter(options);

        //this._etcd.discovery.register({ serviceName });
        this.watchJobState({ jobId: 'hookWatch' });
        this._subscribe();
    }

    _subscribe() {
        this._etcd.tasks.on('change', (res) => {
            this.emit(`task-${res.status}`, res);
        });
        this._etcd.jobs.on('change', (res) => {
            this.emit(`job-${res.state}`, res);
        });
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
        if (options.data) {
            const metadata = null;
            const storageInfo = await this._storageAdapter.putResults({ jobId: options.jobId, data: options.data })
            options.data = { metadata, storageInfo };
        }
        return this._etcd.jobResults.set({ jobId: options.jobId, data: new JobResult(options) });
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

module.exports = new StateManager();