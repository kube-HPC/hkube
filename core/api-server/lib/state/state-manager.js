const EventEmitter = require('events');
const Etcd = require('etcd.hkube');
const storedPipelinesMap = require('../service/storedPipelinesMap.json')

class StateManager extends EventEmitter {

    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
        this._watchJobResults();


        // JUST FOR THIS VERSION:
        this.setPipeline({ name: storedPipelinesMap.name, data: storedPipelinesMap });
    }

    async setExecution(options) {
        return await this._etcd.execution.setExecution(options);
    }

    async getExecution(options) {
        return await this._etcd.execution.getExecution(options);
    }

    async setPipeline(options) {
        return await this._etcd.pipelines.setPipeline(options);
    }

    async getPipeline(options) {
        return await this._etcd.pipelines.getPipeline(options);
    }

    async getPipelines() {
        return await this._etcd.pipelines.getPipelines();
    }

    async deletePipeline(options) {
        return await this._etcd.pipelines.deletePipeline(options);
    }

    async _watchJobResults() {
        await this._etcd.jobResults.watch();
        this._etcd.jobResults.on('status-change', (result) => {
            this.emit('job-status', result);
        });
        this._etcd.jobResults.on('result-change', (result) => {
            this.emit('job-result', result);
        });
    }

    async getJobResult(options) {
        return await this._etcd.jobResults.getResult(options);
    }

    async getJobStatus(options) {
        return await this._etcd.jobResults.getStatus(options);
    }

    async setJobStatus(options) {
        return await this._etcd.jobResults.setStatus(options);
    }

    async stopJob(options) {
        return await this._etcd.jobs.stop(options);
    }
}

module.exports = new StateManager();