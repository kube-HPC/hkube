const Etcd = require('@hkube/etcd');
const { JobStatus, JobResult, Webhook } = require('@hkube/etcd');
const EventEmitter = require('events');
const States = require('./States');
const storageFactory = require('../datastore/storage-factory');
const ActiveState = [States.PENDING, States.ACTIVE, States.RECOVERING];

class StateManager extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        await this._etcd.discovery.register({ serviceName: options.serviceName, data: options });
        this._watchJobResults();
    }

    isActiveState(state) {
        return ActiveState.includes(state);
    }

    setExecution(options) {
        return this._etcd.execution.set(options);
    }

    getExecution(options) {
        return this._etcd.execution.get(options);
    }

    getExecutionsTree(options) {
        return this._etcd.execution.getExecutionsTree(options);
    }

    setAlgorithm(options) {
        return this._etcd.algorithms.templatesStore.set({ name: options.name, data: options });
    }

    getAlgorithm(options) {
        return this._etcd.algorithms.templatesStore.get({ name: options.name });
    }

    getAlgorithmsQueueList() {
        return this._etcd.algorithms.algorithmQueue.list();
    }

    getAlgorithms() {
        return this._etcd.algorithms.templatesStore.list();
    }

    deleteAlgorithm(options) {
        return this._etcd.algorithms.templatesStore.delete(options);
    }

    setPipeline(options) {
        return this._etcd.pipelines.set({ name: options.name, data: options });
    }

    getPipeline(options) {
        return this._etcd.pipelines.get({ name: options.name });
    }

    getPipelines() {
        return this._etcd.pipelines.list();
    }

    deletePipeline(options) {
        return this._etcd.pipelines.delete(options);
    }

    async _watchJobResults() {
        await this._etcd.jobResults.singleWatch();
        await this._etcd.jobStatus.singleWatch();
        this._etcd.jobResults.on('change', (result) => {
            this.emit('job-result', result);
        });
        this._etcd.jobStatus.on('change', (result) => {
            this.emit('job-status', result);
        });
    }

    async getJobResultMetadata(options) {
        return this._etcd.jobResults.get(options);
    }

    async getJobResult(options) {
        const result = await this._etcd.jobResults.get(options);
        return storageFactory.getResults(result);
    }

    async getJobResults(options) {
        const list = await this._etcd.jobResults.list(options);
        return Promise.all(list.map(r => storageFactory.getResults(r)));
    }

    setJobResults(options) {
        return this._etcd.jobResults.set({ jobId: options.jobId, data: new JobResult(options) });
    }

    setWebhook(options) {
        return this._etcd.webhooks.set({ jobId: options.jobId, type: options.type, data: new Webhook(options.data) });
    }

    getWebhook(options) {
        return this._etcd.webhooks.get(options);
    }

    getWebhooks(options) {
        return this._etcd.webhooks.list(options);
    }

    getJobStatus(options) {
        return this._etcd.jobStatus.get(options);
    }

    setJobStatus(options) {
        return this._etcd.jobStatus.set({ jobId: options.jobId, data: new JobStatus(options) });
    }

    stopJob(options) {
        return this._etcd.jobs.stop(options);
    }
}

module.exports = new StateManager();
