const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const { JobStatus, JobResult, Webhook } = require('@hkube/etcd');
const States = require('./States');
const storageFactory = require('../datastore/storage-factory');
const ActiveState = [States.PENDING, States.ACTIVE, States.RECOVERING];
const CompletedState = [States.COMPLETED, States.FAILED, States.STOPPED];

class StateManager extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd();
        this._etcd.init({ etcd: options.etcd, serviceName: options.serviceName });
        await this._etcd.discovery.register({ serviceName: options.serviceName, data: options });
        return this._watchJobResults();
    }

    isActiveState(state) {
        return ActiveState.includes(state);
    }

    isCompletedState(state) {
        return CompletedState.includes(state);
    }

    setExecution(options) {
        return this._etcd.execution.set(options);
    }

    setRunningPipelines(options) {
        return this._etcd.runningPipelines.set(options);
    }

    getExecution(options) {
        return this._etcd.execution.get(options);
    }

    deleteExecution(options) {
        return this._etcd.runningPipelines.delete(options);
    }

    async getExecutions(options, filter = () => true) {
        const executions = await this._etcd.execution.list(options);
        return executions.filter(filter);
    }

    getExecutionsTree(options) {
        return this._etcd.jobStatus.getExecutionsTree(options);
    }

    setAlgorithm(options) {
        return this._etcd.algorithms.templatesStore.set({ name: options.name, data: options });
    }

    setPipelineDriverTemplate(options) {
        return this._etcd.pipelineDrivers.templatesStore.set({ name: options.name, data: options });
    }

    getAlgorithm(options) {
        return this._etcd.algorithms.templatesStore.get({ name: options.name });
    }

    getAlgorithmsQueueList(options) {
        return this._etcd.algorithms.algorithmQueue.list(options);
    }

    getAlgorithms(options) {
        return this._etcd.algorithms.templatesStore.list(options);
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

    async getPipelines(options, filter = () => true) {
        const pipelines = await this._etcd.pipelines.list(options);
        return pipelines.filter(filter);
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

    releaseJobResultsLock(options) {
        return this._etcd.jobResults.releaseChangeLock(options.jobId);
    }

    releaseJobStatusLock(options) {
        return this._etcd.jobStatus.releaseChangeLock(options.jobId);
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

    deleteJobResults(options) {
        return this._etcd.jobResults.delete(options);
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

    deleteWebhook(options) {
        return this._etcd.webhooks.delete(options);
    }

    getJobStatus(options) {
        return this._etcd.jobStatus.get(options);
    }

    getJobStatuses(options) {
        return this._etcd.jobStatus.list(options);
    }

    setJobStatus(options) {
        return this._etcd.jobStatus.set({ jobId: options.jobId, data: new JobStatus(options) });
    }

    deleteJobStatus(options) {
        return this._etcd.jobStatus.delete(options);
    }

    stopJob(options) {
        return this._etcd.jobState.stop(options);
    }
}

module.exports = new StateManager();
