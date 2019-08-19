const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const storageManager = require('@hkube/storage-manager');
const { tracer } = require('@hkube/metrics');
const States = require('./States');
const ActiveState = [States.PENDING, States.ACTIVE, States.RECOVERING];
const CompletedState = [States.COMPLETED, States.FAILED, States.STOPPED];

class StateManager extends EventEmitter {
    async init(options) {
        this._etcd = new Etcd(options.etcd);
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
        return this._etcd.executions.stored.set(options);
    }

    getExecution(options) {
        return this._etcd.executions.stored.get(options);
    }

    deleteExecution(options) {
        return this._etcd.executions.stored.delete(options);
    }

    setRunningPipeline(options) {
        return this._etcd.executions.running.set(options);
    }

    deleteRunningPipeline(options) {
        return this._etcd.executions.running.delete(options);
    }

    async getRunningPipelines(options, filter = () => true) {
        const runningPipelines = await this._etcd.executions.running.list(options);
        return runningPipelines.filter(filter);
    }

    getExecutionsTree(options) {
        return this._etcd.jobs.status.getExecutionsTree(options);
    }

    setAlgorithm(options) {
        return this._etcd.algorithms.store.set(options);
    }

    setPipelineDriverTemplate(options) {
        return this._etcd.pipelineDrivers.store.set(options);
    }

    getAlgorithm(options) {
        return this._etcd.algorithms.store.get(options);
    }

    getAlgorithmsQueueList(options) {
        return this._etcd.algorithms.queue.list(options);
    }

    getAlgorithms(options) {
        return this._etcd.algorithms.store.list(options);
    }

    deleteAlgorithm(options) {
        return this._etcd.algorithms.store.delete(options);
    }

    setPipeline(options) {
        return this._etcd.pipelines.set(options);
    }

    getPipeline(options) {
        return this._etcd.pipelines.get(options);
    }

    async getPipelines(options, filter = () => true) {
        const pipelines = await this._etcd.pipelines.list(options);
        return pipelines.filter(filter);
    }

    deletePipeline(options) {
        return this._etcd.pipelines.delete(options);
    }

    async _watchJobResults() {
        await this._etcd.jobs.results.singleWatch();
        await this._etcd.jobs.status.singleWatch();
        this._etcd.jobs.results.on('change', (result) => {
            this.emit('job-result', result);
        });
        this._etcd.jobs.status.on('change', (result) => {
            this.emit('job-status', result);
        });
    }

    releaseJobResultsLock(options) {
        return this._etcd.jobs.results.releaseChangeLock(options);
    }

    releaseJobStatusLock(options) {
        return this._etcd.jobs.status.releaseChangeLock(options);
    }

    async getJobResult(options) {
        const result = await this._etcd.jobs.results.get(options);
        return this.getResultFromStorage(result);
    }

    async getJobResults(options) {
        const list = await this._etcd.jobs.results.list(options);
        return Promise.all(list.map(r => this.getResultFromStorage(r)));
    }

    setJobResults(options) {
        return this._etcd.jobs.results.set(options);
    }

    deleteJobResults(options) {
        return this._etcd.jobs.results.delete(options);
    }

    setWebhook(options) {
        return this._etcd.webhooks.set(options);
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
        return this._etcd.jobs.status.get(options);
    }

    getJobStatuses(options) {
        return this._etcd.jobs.status.list(options);
    }

    setJobStatus(options) {
        return this._etcd.jobs.status.set(options);
    }

    deleteJobStatus(options) {
        return this._etcd.jobs.status.delete(options);
    }

    stopJob(options) {
        return this._etcd.jobs.state.set({ jobId: options.jobId, state: 'stop', reason: options.reason });
    }

    async getResultFromStorage(options) {
        if (options && options.data && options.data.storageInfo) {
            try {
                const data = await storageManager.get(options.data.storageInfo, tracer.startSpan.bind(tracer, { name: 'storage-get-result' }));
                return { ...options, data, storageModule: storageManager.moduleName };
            }
            catch (error) {
                return { error: new Error(`failed to get from storage: ${error.message}`) };
            }
        }
        return options;
    }

    async getBuilds(options) {
        return this._etcd.algorithms.builds.list(options);
    }

    async getBuild(options) {
        return this._etcd.algorithms.builds.get(options);
    }

    async setBuild(options) {
        await this._etcd.algorithms.builds.set(options);
    }

    async updateBuild(options) {
        await this._etcd.algorithms.builds.update(options);
    }
}

module.exports = new StateManager();
