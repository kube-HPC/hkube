const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const States = require('./States');
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
        return this._etcd.jobResults.getResult(options);
    }

    async getCompletedJobs() {
        return this._etcd.jobResults.getResults(s => (s.status && s.status.data.status === States.COMPLETED) || (s.result && s.result.data.status === States.COMPLETED));
    }

    async setJobResultsLog(options) {
        return this._etcd.jobResults.setResultsLog(options);
    }

    async setJobStatusLog(options) {
        return this._etcd.jobResults.setStatusLog(options);
    }

    async getJobResultsLog(options) {
        return this._etcd.jobResults.getResultsLog(options);
    }

    async getJobStatusLog(options) {
        return this._etcd.jobResults.getStatusLog(options);
    }

    async getJobStatus(options) {
        return this._etcd.jobResults.getStatus(options);
    }

    async setJobStatus(options) {
        const payload = {
            timestamp: new Date(),
            pipeline: options.pipeline,
            data: options.data
        };
        return this._etcd.jobResults.setStatus({ jobId: options.jobId, data: payload });
    }

    async stopJob(options) {
        return this._etcd.jobs.stop(options);
    }
}

module.exports = new StateManager();
