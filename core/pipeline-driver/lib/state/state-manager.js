
const Etcd = require('etcd.rf');

class StateManager {

    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
    }

    updateInit(jobId) {
        this._etcd.updateInitSetting({ jobId });
    }

    async getTaskState(options) {
        return await this._etcd.services.pipelineDriver.getTaskState(options.taskId);
    }

    async setTaskState(options) {
        return await this._etcd.services.pipelineDriver.setTaskState(options.taskId, options.value);
    }

    async setJobResults(options) {
        return await this._etcd.jobs.setJobResults(options);
    }

    async getState() {
        const driver = await this._etcd.services.pipelineDriver.getState();
        if (driver) {
            const driverTasks = await this._etcd.services.pipelineDriver.getDriverTasks();
            const jobTasks = await this._etcd.jobs.getJobsTasks();
            const result = Object.assign({}, driver);
            result.driverTasks = driverTasks || [];
            result.jobTasks = jobTasks || new Map();
            return result;
        }
        return null;
    }

    async setState(options) {
        await this._etcd.services.pipelineDriver.setState(options);
    }

    async deleteState() {
        return await this._etcd.services.pipelineDriver.deleteState();
    }

    onTaskResult(options, callback) {
        this._etcd.jobs.onTaskResult(options, callback);
    }
}

module.exports = new StateManager();