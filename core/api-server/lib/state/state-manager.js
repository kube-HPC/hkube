const Etcd = require('@hkube/etcd');
const { JobStatus } = require('@hkube/etcd');
const EventEmitter = require('events');
const States = require('./States');
const storageFactory = require('../datastore/storage-factory');
const ActiveState = [States.PENDING, States.ACTIVE, States.RECOVERING];

class StateManager extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        await this._etcd.discovery.register({ serviceName: options.serviceName, data: options });
        this._etcd.discovery.get();
        this._watchJobResults();
    }

    isActiveState(state) {
        return ActiveState.includes(state);
    }

    setExecution(options) {
        return this._etcd.execution.setExecution(options);
    }

    getExecution(options) {
        return this._etcd.execution.getExecution(options);
    }

    getExecutionsTree(options) {
        return this._etcd.execution.getExecutionsTree(options);
    }

    setAlgorithm(options) {
        return this._etcd.algorithms.templatesStore.setAlgorithm({ name: options.name, data: options });
    }

    getAlgorithm(options) {
        return this._etcd.algorithms.templatesStore.getAlgorithm({ name: options.name });
    }

    getAlgorithms() {
        return this._etcd.algorithms.templatesStore.list();
    }

    deleteAlgorithm(options) {
        return this._etcd.algorithms.templatesStore.deleteAlgorithm(options);
    }

    setPipeline(options) {
        return this._etcd.pipelines.setPipeline({ name: options.name, data: options });
    }

    getPipeline(options) {
        return this._etcd.pipelines.getPipeline({ name: options.name });
    }

    getPipelines() {
        return this._etcd.pipelines.list();
    }

    deletePipeline(options) {
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
        return storageFactory.getResults(result);
    }

    getCompletedJobs() {
        return this._etcd.jobResults.getResultsByFilter(s => (s.status && s.status.status === States.COMPLETED) || (s.result && s.result.status === States.COMPLETED));
    }

    setWebhooksResults(options) {
        return this._etcd.jobResults.setWebhooksResults(options);
    }

    setWebhooksStatus(options) {
        return this._etcd.jobResults.setWebhooksStatus(options);
    }

    getWebhooksResults(options) {
        return this._etcd.jobResults.getWebhooksResults(options);
    }

    getWebhooksStatus(options) {
        return this._etcd.jobResults.getWebhooksStatus(options);
    }

    getJobStatus(options) {
        return this._etcd.jobResults.getStatus(options);
    }

    setJobStatus(options) {
        return this._etcd.jobResults.setStatus({ jobId: options.jobId, data: new JobStatus(options) });
    }

    stopJob(options) {
        return this._etcd.jobs.stop(options);
    }
}

module.exports = new StateManager();
