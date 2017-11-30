const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const States = require('lib/state/States');

class StateManager extends EventEmitter {

    constructor() {
        super();
    }

    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
        this._watch();
    }

    setCurrentJobID(jobId) {
        this._jobId = jobId;
    }

    _watch() {
        this._etcd.tasks.on('change', (res) => {
            this.emit(`task-${res.status}`, res);
        });
        this._etcd.jobs.on('change', (res) => {
            this.emit(`job-${res.state}`, res);
        });
    }

    async getTaskState(options) {
        return await this._etcd.services.pipelineDriver.getTaskState({ jobId: this._jobId, taskId: options.taskId });
    }

    async setTaskState(options) {
        return await this._etcd.services.pipelineDriver.setTaskState({ jobId: this._jobId, taskId: options.taskId, data: options.data });
    }

    async getDriverTasks() {
        return await this._etcd.services.pipelineDriver.getDriverTasks({ jobId: this._jobId });
    }

    async setJobResults(options) {
        const payload = {
            timestamp: new Date(),
            execution_id: this._jobId,
            data: options
        }
        return await this._etcd.jobResults.setResults({ jobId: this._jobId, data: payload });
    }

    async setJobStatus(options) {
        const payload = {
            timestamp: new Date(),
            execution_id: this._jobId,
            data: options
        }
        return await this._etcd.jobResults.setStatus({ jobId: this._jobId, data: payload });
    }

    async getState() {
        let result = null;
        const options = { jobId: this._jobId };
        const driver = await this._etcd.services.pipelineDriver.getState(options);
        if (driver) {
            const driverTasks = await this._etcd.services.pipelineDriver.getDriverTasks(options);
            const jobTasks = await this._etcd.tasks.list(options);
            result = Object.assign({}, driver);
            result.driverTasks = driverTasks || [];
            result.jobTasks = jobTasks || new Map();
        }
        return result;
    }

    async setState(options) {
        await this._etcd.services.pipelineDriver.setState({ jobId: this._jobId, data: { state: options.data, startTime: new Date() } });
    }

    async deleteState(options) {
        return await this._etcd.services.pipelineDriver.deleteState(options);
    }

    async getExecution(options) {
        return await this._etcd.execution.getExecution(options);
    }

    async watchTasks() {
        return await this._etcd.tasks.watch({ jobId: this._jobId });
    }

    async unWatchTasks() {
        return await this._etcd.tasks.unwatch({ jobId: this._jobId });
    }

    async watchJobState() {
        return await this._etcd.jobs.watch({ jobId: this._jobId });
    }

    async unWatchJobState() {
        return await this._etcd.jobs.unwatch({ jobId: this._jobId });
    }
}

module.exports = new StateManager();