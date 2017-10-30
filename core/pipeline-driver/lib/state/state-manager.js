
const Etcd = require('etcd.rf');

class StateManager {

    constructor() {
        this._etcd = null;
    }

    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
    }

    updateInit(jobId) {
        this._etcd.updateInitSetting({ jobId });
    }

    async setDriverState(options) {
        await this._etcd.services.pipelineDriver.setState(options.value);
    }

    deleteDriverState(options) {
        this._etcd.delete(`${DRIVERS_PATH}/${options.jobID}/instance`);
    }

    async _getDriverState(options) {
        return await this._etcd.services.pipelineDriver.getState();
    }

    async getTaskState(options) {
        return await this._etcd.services.pipelineDriver.getTaskState(options.taskID);
    }

    async setTaskState(options) {
        return await this._etcd.services.pipelineDriver.setTaskState(options.taskID, options.value);
    }

    async setJobResults(options) {
        return await this._etcd.jobs.setJobResults(options);
    }

    async _getDriverTasks(options) {
        return await this._etcd.services.pipelineDriver.getDriverTasks();
    }

    async _getJobTasks(options) {
        return await this._etcd.jobs.getJobsTasks();
    }

    async getState(options) {
        const driver = await this._getDriverState(options);
        if (driver) {
            const driverTasks = await this._getDriverTasks(options);
            const jobTasks = await this._getJobTasks(options);
            const result = Object.assign({}, driver);
            result.driverTasks = driverTasks || [];
            result.jobTasks = jobTasks || [];
            return result;
        }
        return null;
    }

    onJobResult(options, callback) {
        this._etcd.jobs.onJobResult(options, callback);
    }
}

module.exports = new StateManager();