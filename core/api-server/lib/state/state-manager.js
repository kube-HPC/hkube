const Etcd = require('@hkube/etcd');
const { JobStatus } = require('@hkube/etcd');
const EventEmitter = require('events');
const States = require('./States');
const storageFactory = require('../datastore/storage-factory');
const ActiveState = [States.PENDING, States.ACTIVE, States.RECOVERING];

class StateManager extends EventEmitter {
    init({ serviceName, etcd }) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd, serviceName });
        this._etcd.discovery.register({ serviceName });
        this._watchJobResults();
    }

    isActiveState(state) {
        return ActiveState.includes(state);
    }

    async setExecution(options) {
        return this._etcd.execution.setExecution(options);
    }

    async getExecution(options) {
        return this._etcd.execution.getExecution(options);
    }

    async getExecutionsTree(options) {
        return this._etcd.execution.getExecutionsTree(options);
    }

    async setPipeline(options) {
        return this._etcd.pipelines.setPipeline({ name: options.name, data: options });
    }

    async getPipeline(options) {
        return this._etcd.pipelines.getPipeline({ name: options.name });
    }

    async getPipelines() {
        return this._etcd.pipelines.getPipelines();
    }

    async deletePipeline(options) {
        return this._etcd.pipelines.deletePipeline(options);
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
        const result = await this._etcd.jobResults.getResults(options);
        if (result.data) {
            await storageFactory.getAndReplaceResults(result);
        }
        return result;
    }

    async getCompletedJobs() {
        return this._etcd.jobResults.getResultsByFilter(s => (s.status && s.status.status === States.COMPLETED) || (s.result && s.result.status === States.COMPLETED));
    }

    async setWebhooksResults(options) {
        return this._etcd.jobResults.setWebhooksResults(options);
    }

    async setWebhooksStatus(options) {
        return this._etcd.jobResults.setWebhooksStatus(options);
    }

    async getWebhooksResults(options) {
        return this._etcd.jobResults.getWebhooksResults(options);
    }

    async getWebhooksStatus(options) {
        return this._etcd.jobResults.getWebhooksStatus(options);
    }

    async getJobStatus(options) {
        return this._etcd.jobResults.getStatus(options);
    }

    async setJobStatus(options) {
        return this._etcd.jobResults.setStatus({ jobId: options.jobId, data: new JobStatus(options) });
    }

    async stopJob(options) {
        return this._etcd.jobs.stop(options);
    }
}

module.exports = new StateManager();
