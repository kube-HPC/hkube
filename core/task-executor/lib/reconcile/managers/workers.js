const clonedeep = require('lodash.clonedeep');
const etcd = require('../../helpers/etcd');
const { commands } = require('../../consts');
const { normalizeWorkers,
    normalizeWorkerImages,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeJobs,
    mergeWorkers } = require('../normalize');

/**
 * Manages worker state, categorization, and readiness for scheduling.
 */
class WorkersManager {
    /**
     * Creates an instance of WorkersManager and normalizes all worker-related data.
     * @param {Object[]} workers - List of worker objects from etcd.
     * @param {Object} jobs - Kubernetes jobs object.
     * @param {Object[]} pods - Kubernetes pod objects.
     * @param {Object} algorithmTemplates - Algorithm definitions from DB.
     * @param {Object} versions - System versions object.
     * @param {Object} registry - Registry configuration.
     */
    constructor(workers, jobs, pods, algorithmTemplates, versions, registry) {
        this._algorithmTemplates = algorithmTemplates;

        // 1. Normalize raw worker list from etcd into simplified structure
        this.normalizedWorkers = normalizeWorkers(workers);

        // 2. Normalize raw jobs from Kubernetes into simplified structure
        const normalizedJobs = normalizeJobs(jobs, pods, j => (!j.status.succeeded && !j.status.failed));

        // 3. Merge workers with their associated jobs (undefined for job if none); also detect jobs with no assigned worker
        const { jobAttachedWorkers, extraJobs } = mergeWorkers(this.normalizedWorkers, normalizedJobs);
        // A list of jobs that already have been created but no worker registered to it yet.
        this.jobsPendingForWorkers = clonedeep(extraJobs);

        // 4. Identify workers that must exit due to image/version changes
        this._workersToExit = normalizeWorkerImages(this.normalizedWorkers, algorithmTemplates, versions, registry);

        // 5. Filter out exiting workers from the merged list
        this.jobAttachedWorkers = jobAttachedWorkers.filter(
            w => !this._workersToExit.find(e => e.id === w.id)
        );
    }

    /**
     * Counts the total number of batch workers (idle + active).
     * @returns {number} Number of batch workers.
     */
    countBatchWorkers() {
        const idleWorkers = this.getIdleWorkers();
        const activeWorkers = this.getActiveWorkers();
        const filterCondition = worker => this._algorithmTemplates[worker.algorithmName]?.stateType === undefined;
        const batchWorkers = idleWorkers.filter(filterCondition);
        const activeBatchWorkers = activeWorkers.filter(filterCondition);
        return batchWorkers.length + activeBatchWorkers.length;
    }

    /**
     * Returns list of workers that are currently idle (ready and not paused).
     * @returns {Object[]} List of idle workers.
     */
    getIdleWorkers() {
        const idleWorkers = clonedeep(this.jobAttachedWorkers.filter(w => this._isIdleWorker(w)));
        return idleWorkers;
    }

    /**
     * Returns list of workers that are currently active (not ready, not paused, not bootstrapping).
     * @returns {Object[]} List of active workers.
     */
    getActiveWorkers() {
        const activeWorkers = clonedeep(this.jobAttachedWorkers.filter(w => this._isActiveWorker(w)));
        return activeWorkers;
    }

    /**
     * Returns list of workers that are currently paused (ready and paused).
     * @returns {Object[]} List of paused workers.
     */
    getPausedWorkers() {
        const pausedWorkers = clonedeep(this.jobAttachedWorkers.filter(w => this._isPausedWorker(w)));
        return pausedWorkers;
    }

    /**
     * Returns list of workers that are currently boostrapping (status bootstrap).
     * @returns {Object[]} List of boostrapping workers.
     */
    getBootstrappingWorkers() {
        const bootstrappingWorkers = clonedeep(this.jobAttachedWorkers.filter(w => w.workerStatus === 'bootstrap'));
        return bootstrappingWorkers;
    }

    /**
     * Sends an exit command to every worker that must exit due to image/version changes, instructing it to terminate.
     *
     * @returns {Promise} Response from etcd.
     */
    handleExitWorkers() {
        const workersToExitPromises = this._workersToExit.map((worker => {
            return etcd.sendCommandToWorker({
                workerId: worker.id, command: commands.exit, message: worker.message, algorithmName: worker.algorithmName, podName: worker.podName
            });
        }));

        return workersToExitPromises;
    }

    /**
     * Identifying a list of workers that needs to warm-up and be marked as 'hot' (cold → hot transition).
     * Next, sends a warm-up command to every worker identified.
     * @returns {Promise} Response from etcd.
     */
    handleWarmUpWorkers() {
        const workersToWarmUp = normalizeHotWorkers(this.jobAttachedWorkers, this._algorithmTemplates);

        const workersToWarmUpPromises = workersToWarmUp.map((worker => {
            return etcd.sendCommandToWorker({
                workerId: worker.id, command: commands.warmUp, algorithmName: worker.algorithmName, podName: worker.podName
            });
        }));

        return workersToWarmUpPromises;
    }

    /**
     * Identifying a list of workers that needs to cool down (hot → cold transition).
     * Next, sends a cool-down command to every worker identified.
     * @returns {Promise} Response from etcd.
     */
    handleCoolDownWorkers() {
        const workersToCoolDown = normalizeColdWorkers(this.jobAttachedWorkers, this._algorithmTemplates);

        const workersToCoolDownPromises = workersToCoolDown.map((worker => {
            return etcd.sendCommandToWorker({
                workerId: worker.id, command: commands.warmUp, algorithmName: worker.algorithmName, podName: worker.podName
            });
        }));

        return workersToCoolDownPromises;
    }

    /**
     * Sends a stop-processing command to every worker in the given list, halting further job execution.
     *
     * @private
     * @param {Object} workers - Workers list to resume.
     * @returns {Promise} Response from etcd.
     */
    stop(workers) {
        const workersToStopPromises = workers.map((worker) => {
            return etcd.sendCommandToWorker({
                workerId: worker.id, command: commands.stopProcessing, algorithmName: worker.algorithmName, podName: worker.podName
            });
        });
        return workersToStopPromises;
    }

    /**
     * Sends a start-processing command to every worker in the given list, resuming job execution.
     *
     * @private
     * @param {Object} workers - Workers list to resume.
     * @returns {Promise} Response from etcd.
     */
    resume(workers) {
        const workersToResumePromises = workers.map((worker) => {
            return etcd.sendCommandToWorker({
                workerId: worker.id, command: commands.startProcessing, algorithmName: worker.algorithmName, podName: worker.podName
            });
        });
        return workersToResumePromises;
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

module.exports = WorkersManager;
