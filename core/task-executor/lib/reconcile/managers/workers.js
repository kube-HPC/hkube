const clonedeep = require('lodash.clonedeep');
const { normalizeWorkers,
    normalizeWorkerImages,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeJobs,
    mergeWorkers } = require('../normalize');

/**
 * Manages worker state, categorization, and readiness for scheduling.
 */
class WorkersStateManager {
    /**
     * Creates an instance of WorkersStateManager and normalizes all worker-related data.
     * @param {Object[]} workers - List of worker objects from etcd.
     * @param {Object} jobs - Kubernetes jobs object.
     * @param {Object[]} pods - Kubernetes pod objects.
     * @param {Object} algorithmTemplates - Algorithm definitions from DB.
     * @param {Object} versions - System versions object.
     * @param {Object} registry - Registry configuration.
     */
    constructor(workers, jobs, pods, algorithmTemplates, versions, registry) {
        // Normalize raw worker list from etcd into simplified structure
        this.normalizedWorkers = normalizeWorkers(workers);

        // Normalize raw jobs from Kubernetes into simplified structure
        const normalizedJobs = normalizeJobs(jobs, pods, j => (!j.status.succeeded && !j.status.failed));

        // Merge workers with their associated jobs (undefined for job if none); also detect jobs with no assigned worker
        const merged = mergeWorkers(this.normalizedWorkers, normalizedJobs);

        // Identify workers that must exit due to image/version changes
        this.workersToExit = normalizeWorkerImages(this.normalizedWorkers, algorithmTemplates, versions, registry);

        // Filter out exiting workers from the merged list
        this.jobAttachedWorkers = merged.jobAttachedWorkers.filter(
            w => !this.workersToExit.find(e => e.id === w.id)
        );

        // Detect workers that need to turn and be marked as 'hot' (cold → hot transition)
        this.workersToWarmUp = normalizeHotWorkers(this.jobAttachedWorkers, algorithmTemplates);

        // Detect workers that need cooling down (hot → cold transition)
        this.workersToCoolDown = normalizeColdWorkers(this.jobAttachedWorkers, algorithmTemplates);

        // Categorize workers into idle, active, paused, pending, and bootstrap
        this.workerCategories = this._buildWorkerCategories(this.jobAttachedWorkers, merged.extraJobs);
    }

    /**
     * Counts the total number of batch workers (idle + active).
     * @param {Object} algorithmTemplates - Algorithm definitions.
     * @returns {number} Number of batch workers.
     */
    countBatchWorkers(algorithmTemplates) {
        const { idleWorkers, activeWorkers } = this.workerCategories;
        const filterCondition = worker => algorithmTemplates[worker.algorithmName]?.stateType === undefined;
        const batchWorkers = idleWorkers.filter(filterCondition);
        const activeBatchWorkers = activeWorkers.filter(filterCondition);
        return batchWorkers.length + activeBatchWorkers.length;
    }

    /**
     * Categorizes workers into idle, active, paused, pending, and bootstrap.
     * @private
     * @param {Object[]} jobAttachedWorkers - List of merged worker/job objects.
     * @param {Object} extraJobs - Object containing jobs with no worker assigned to them.
     * @returns {Object} Categorized workers.
     */
    _buildWorkerCategories(jobAttachedWorkers, extraJobs) {
        // Identify worker types
        const idleWorkers = clonedeep(jobAttachedWorkers.filter(w => this._isIdleWorker(w)));
        const activeWorkers = clonedeep(jobAttachedWorkers.filter(w => this._isActiveWorker(w)));
        const pausedWorkers = clonedeep(jobAttachedWorkers.filter(w => this._isPausedWorker(w)));
        const bootstrapWorkers = clonedeep(jobAttachedWorkers.filter(w => w.workerStatus === 'bootstrap'));
        // workers that already have a job created but no worker registered yet:
        const pendingWorkers = clonedeep(extraJobs);
        
        return {
            idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, bootstrapWorkers
        };
    }

    /**
     * Checks if a worker is idle (ready and not paused).
     * @private
     * @param {Object} worker - Worker object.
     * @param {string} [algorithmName] - Optional algorithm name filter.
     * @returns {boolean} True if worker is idle.
     */
    _isIdleWorker(worker, algorithmName) {
        let match = worker.workerStatus === 'ready' && !worker.workerPaused;
        if (algorithmName) {
            match = match && worker.algorithmName === algorithmName;
        }
        return match;
    }

    /**
     * Checks if a worker is active (not ready, not paused, not bootstrapping).
     * @private
     * @param {Object} worker - Worker object.
     * @param {string} [algorithmName] - Optional algorithm name filter.
     * @returns {boolean} True if worker is active.
     */
    _isActiveWorker(worker, algorithmName) {
        let match = worker.workerStatus !== 'ready' && !worker.workerPaused && worker.workerStatus !== 'bootstrap';
        if (algorithmName) {
            match = match && worker.algorithmName === algorithmName;
        }
        return match;
    }

    /**
     * Checks if a worker is paused (ready and paused).
     * @private
     * @param {Object} worker - Worker object.
     * @param {string} [algorithmName] - Optional algorithm name filter.
     * @returns {boolean} True if worker is paused.
     */
    _isPausedWorker(worker, algorithmName) {
        let match = worker.workerStatus === 'ready' && worker.workerPaused;
        if (algorithmName) {
            match = match && worker.algorithmName === algorithmName;
        }
        return match;
    }
}

module.exports = WorkersStateManager;
