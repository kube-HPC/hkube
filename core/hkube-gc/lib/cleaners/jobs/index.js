const log = require('@hkube/logger').GetLogFromContainer();
const etcd = require('../../helpers/etcd');
const kubernetes = require('../../helpers/kubernetes');
const PodTypes = require('../../consts/pod-types');
const { normalizePods } = require('./normalize');
const BaseCleaner = require('../../core/base-cleaner');

class Cleaner extends BaseCleaner {
    async deleteJobs(jobs) {
        for (const j of jobs) { // eslint-disable-line
            await kubernetes.deleteJob(j); // eslint-disable-line
        }
    }

    async _filterJobs({ type, pods, completedMaxAge, failedMaxAge, pendingMaxAge }) {
        const completedToDelete = pods.filter(p => p.completed && p.age > completedMaxAge);
        const failedToDelete = pods.filter(p => p.failed && p.age > failedMaxAge);
        const waitingToDelete = pods.filter(p => p.waiting && p.age > failedMaxAge);
        const pendingToDelete = pods.filter(p => p.unschedulable && (p.age > pendingMaxAge || !p.requested));
        const jobs = [...pendingToDelete, ...completedToDelete, ...failedToDelete, ...waitingToDelete];

        if (jobs.length > 0) {
            log.info(`Delete ${type} jobs: failed: ${failedToDelete.length}, completed: ${completedToDelete.length}, pending: ${pendingToDelete.length},  waiting: ${waitingToDelete.length}`);
        }
        return jobs.map(j => ({ podName: j.podName, jobName: j.jobName }));
    }

    async _fetchWorkers(options) {
        const requests = await etcd.getAlgorithmRequests();
        const podsRaw = await kubernetes.getWorkerPods();
        const jobsRaw = await kubernetes.getWorkerJobs();
        const pods = normalizePods(podsRaw, requests, jobsRaw);
        return this._filterJobs({ type: PodTypes.WORKER, pods, ...options });
    }

    async _fetchPipelineDrivers(options) {
        const podsRaw = await kubernetes.getPipelineDriversPods();
        const pods = normalizePods(podsRaw);
        return this._filterJobs({ type: PodTypes.PIPELINE_DRIVER, pods, ...options });
    }

    async _fetchAlgorithmBuilders(options) {
        const podsRaw = await kubernetes.getAlgorithmBuilderPods();
        const pods = normalizePods(podsRaw);
        return this._filterJobs({ type: PodTypes.ALGORITHM_BUILDER, pods, ...options });
    }

    async clean({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        await this.deleteJobs(data);
        this.setResultCount(data.length);
        return this.getStatus();
    }

    async dryRun({ maxAge } = {}) {
        const data = await this.fetch({ maxAge });
        return this.dryRunResult(data);
    }

    async fetch({ maxAge } = {}) {
        const completedMaxAge = this.resolveMaxAge(maxAge, this._config.maxAge.completedMaxAge);
        const failedMaxAge = this.resolveMaxAge(maxAge, this._config.maxAge.failedMaxAge);
        const pendingMaxAge = this.resolveMaxAge(maxAge, this._config.maxAge.pendingMaxAge);

        const settings = {
            completedMaxAge,
            failedMaxAge,
            pendingMaxAge
        };
        const workers = await this._fetchWorkers(settings);
        const drivers = await this._fetchPipelineDrivers(settings);
        const builders = await this._fetchAlgorithmBuilders(settings);
        return [...workers, ...drivers, ...builders];
    }
}

module.exports = Cleaner;
