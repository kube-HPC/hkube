const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');

class StateManager extends EventEmitter {
    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
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
        const payload = {
            timestamp: new Date(),
            pipeline: options.pipeline,
            data: options.data
        }
        return this._etcd.jobResults.setResults({ jobId: options.jobId, data: payload });
    }

    async setJobStatus(options) {
        const payload = {
            timestamp: new Date(),
            pipeline: options.pipeline,
            data: options.data
        }
        return this._etcd.jobResults.setStatus({ jobId: options.jobId, data: payload });
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
        return this._etcd.execution.getExecution(options);
    }

    async setExecution(options) {
        return this._etcd.execution.setExecution(options);
    }

    async watchTasks(options) {
        return this._etcd.tasks.watch(options);
    }

    async unWatchTasks(options) {
        return this._etcd.tasks.unwatch(options);
    }

    async watchJobState(options) {
        return this._etcd.jobs.watch(options);
    }

    async unWatchJobState(options) {
        return this._etcd.jobs.unwatch(options);
    }
}

module.exports = new StateManager();