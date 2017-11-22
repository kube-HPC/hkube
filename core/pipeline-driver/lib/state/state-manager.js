
const Etcd = require('etcd.hkube');

class StateManager {

    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
    }

    setCurrentJob(job) {
        this._job = job;
    }

    async getTaskState(options) {
        return await this._etcd.services.pipelineDriver.getTaskState(options);
    }

    async setTaskState(options) {
        return await this._etcd.services.pipelineDriver.setTaskState({ jobId: this._job.id, taskId: options.taskId, data: options.data });
    }

    async setJobResults(options) {
        return await this._etcd.jobResults.setResults({ jobId: this._job.id, data: { result: options.result } });
    }

    async setJobStatus(options) {
        return await this._etcd.jobResults.setStatus({ jobId: this._job.id, data: { status: options.status, error: options.error } });
    }

    async getState() {
        const options = { jobId: this._job.id };
        const driver = await this._etcd.services.pipelineDriver.getState(options);
        if (driver) {
            const driverTasks = await this._etcd.services.pipelineDriver.getDriverTasks(options);
            const jobTasks = await this._etcd.tasks.list(options);
            const result = Object.assign({}, driver);
            result.driverTasks = driverTasks || [];
            result.jobTasks = jobTasks || new Map();
            return result;
        }
        return null;
    }

    async setState(options) {
        await this._etcd.services.pipelineDriver.setState({ jobId: this._job.id, data: options.data });
    }

    async deleteState(options) {
        return await this._etcd.services.pipelineDriver.deleteState(options);
    }

    async getExecution(options) {
        return await this._etcd.execution.getExecution(options);
    }

    async onTaskState(options, callback) {
        return await this._etcd.tasks.onStateChange({ jobId: this._job.id, taskId: options.taskId }, callback);
    }

    async onJobStopped(callback) {
        return await this._etcd.jobs.onStopped({ jobId: this._job.id }, callback);
    }
}

module.exports = new StateManager();