
const Etcd = require('etcd.rf');

class StateManager {

    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
    }

    async getTaskState(options) {
        return await this._etcd.services.pipelineDriver.getTaskState(options);
    }

    async setTaskState(options) {
        return await this._etcd.services.pipelineDriver.setTaskState(options);
    }

    async setJobResults(options) {
        return await this._etcd.jobs.setResults(options);
    }

    async setJobStatus(options) {
        return await this._etcd.jobs.setStatus(options);
    }

    async getState(options) {
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
        await this._etcd.services.pipelineDriver.setState(options);
    }

    async deleteState(optionsoptions) {
        return await this._etcd.services.pipelineDriver.deleteState(options);
    }

    onTaskResult(options, callback) {
        this._etcd.tasks.onResult(options, callback);
    }
}

module.exports = new StateManager();