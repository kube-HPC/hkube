const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const { settings } = require('../helpers/settings');
const etcd = require('../helpers/etcd');
const { components, consts } = require('../consts');
const component = components.RECONCILER;
const { WorkersManager, requestPreprocessor, jobsHandler } = require('./managers');

const { CPU_RATIO_PRESSURE, MEMORY_RATIO_PRESSURE } = consts;

/**
 * Checks if there is resource pressure (CPU or Memory) based on the provided normalized resources.
 * Logs the details of CPU and memory pressure if either exceeds the defined threshold.
 * 
 * @param {Object} normResources - Normalized resource usage data.
 * @param {Object} normResources.allNodes - Resource data for all nodes.
 * @param {Object} normResources.allNodes.ratio - Resource usage ratios.
 * @param {number} normResources.allNodes.ratio.cpu - The CPU usage ratio (0-1).
 * @param {number} normResources.allNodes.ratio.memory - The memory usage ratio (0-1).
 */
const _checkResourcePressure = (normResources) => {
    const isCpuPressure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESSURE;
    const isMemoryPressure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESSURE;
    const isResourcePressure = isCpuPressure || isMemoryPressure;
    if (isResourcePressure) {
        log.trace(`isCpuPressure: ${isCpuPressure}, isMemoryPressure: ${isMemoryPressure}`, { component });
    }
};

/**
 * Calculates statistics for workers, grouped by algorithm name.
 * For each algorithm, it counts the number of workers in various states (e.g., ready, working, etc.), 
 * and tracks redundant (workers with no status) and hot workers.
 *
 * @param {Object[]} workers - List of workers.
 * @param {string} workers[].algorithmName - Algorithm name.
 * @param {string} [workers[].workerStatus] - Worker status (init, ready, working, exit).
 * @param {boolean} [workers[].hotWorker] - Whether worker is hot.
 * @returns {{ stats: Object[], total: number }} Aggregated stats and total workers.
 */
const _aggregateWorkerStats = (workers) => {
    const stats = Object.values(workers.reduce((acc, worker) => {
        const { algorithmName, workerStatus, hotWorker } = worker;
        if (!acc[algorithmName]) {
            acc[algorithmName] = {
                algorithmName,
                count: 0,
                init: 0,
                ready: 0,
                working: 0,
                exit: 0,
                hot: 0
            };
        }
        acc[algorithmName].count += 1;
        if (workerStatus) {
            acc[algorithmName][workerStatus] += 1;
        }
        else acc[algorithmName].redundant = (acc[algorithmName].redundant || 0) + 1;
        if (hotWorker) {
            acc[algorithmName].hot += 1;
        }
        return acc;
    }, {}));

    return { stats, total: workers.length };
};

/**
 * Builds resource and worker statistics per node.
 *
 * @param {Object} normResources - Normalized resources.
 * @param {Object[]} normalizedWorkers - Normalized workers list.
 * @returns {Object[]} Stats per node including resources and aggregated worker stats.
 */
const _buildNodeStats = (normResources, normalizedWorkers) => {
    const clonedResources = clonedeep(normResources);

    const statsPerNode = clonedResources.nodeList.map(node => {
        const nodeWorkers = normalizedWorkers.filter(w => node.workers.some(nw => nw.podName === w.podName));

        return {
            name: node.name,
            total: {
                cpu: node.total.cpu,
                gpu: node.total.gpu,
                mem: node.total.memory,

            },
            requests: {
                cpu: node.requests.cpu,
                gpu: node.requests.gpu,
                mem: node.requests.memory,

            },
            other: {
                cpu: node.other.cpu,
                gpu: node.other.gpu,
                mem: node.other.memory,
            },
            workersTotal: {
                cpu: node.workersTotal.cpu,
                gpu: node.workersTotal.gpu,
                mem: node.workersTotal.memory,
            },
            labels: node.labels,
            workers2: node.workers,
            workers: _aggregateWorkerStats(nodeWorkers)
        };
    });
    return statsPerNode;
};

/**
 * Retrieves default CPU and memory resources for workers.
 *
 * Priority:
 * 1. Use explicit worker resources from options if `applyResources` is enabled.
 * 2. Otherwise, fallback to Kubernetes container default requests.
 *
 * @async
 * @param {Object} options - Configuration options.
 * @param {Object} options.resources - Resource configurations.
 * @param {Object} options.resources.worker - Worker resource configuration.
 * @param {number|string} [options.resources.worker.cpu] - Worker CPU request.
 * @param {number|string} [options.resources.worker.mem] - Worker memory request.
 * @param {Object} containerDefaults - Default container resources from Kubernetes.
 * @param {Object} [containerDefaults.cpu] - Default CPU resource from Kubernetes.
 * @param {string|number} [containerDefaults.cpu.defaultRequest] - Default CPU request
 * @param {Object} [containerDefaults.memory] - Default memory resource from Kubernetes.
 * @param {string|number} [containerDefaults.memory.defaultRequest] - Default memory request
 * @returns {Promise<{cpu: (number|string|undefined), mem: (number|string|undefined)}>}
 *          Default worker resources (CPU, memory), or `undefined` if not resolved.
 */
const _resolveWorkerResourceDefaults = async (options, containerDefaults) => {
    const defaults = {};

    if (settings.applyResources) {
        defaults.cpu = options.resources.worker.cpu;
        defaults.mem = options.resources.worker.mem;
    }

    if (!defaults.cpu && containerDefaults.cpu) defaults.cpu = containerDefaults.cpu.defaultRequest;
    if (!defaults.mem && containerDefaults.memory) defaults.mem = containerDefaults.memory?.defaultRequest;
    
    return defaults;
};

/**
 * Updates reconciliation results with job and worker statistics,
 * synchronizes the current cluster state with etcd, and logs summary information.
 *
 * @param {Object} params
 * @param {Object.<string, Object>} params.reconcileResult - Current reconciliation results per algorithm.
 * @param {Object} params.unScheduledAlgorithms - Algorithms that could not be scheduled and were skipped.
 * @param {Object} params.ignoredUnScheduledAlgorithms - Algorithms previously unscheduled but now ignored (if they were created, not requested anymore, or removed from templates).
 * @param {Object} params.jobsInfo - Job scheduling information.
 * @param {Object[]} params.jobsInfo.created - Jobs successfully created.
 * @param {Object[]} params.jobsInfo.skipped - Jobs that were skipped due any reason (resources missing etc).
 * @param {Object[]} params.jobsInfo.toStop - Jobs whose workers should be stopped.
 * @param {Object[]} params.jobsInfo.toResume - Jobs whose workers should be resumed.
 * @param {Object[]} params.normalizedWorkers - Normalized workers.
 * @param {Object} params.normResources - Normalized cluster resources.
 * @param {Object} params.options - Global configuration.
 * @param {Object} params.containerDefaults - Default container resources from Kubernetes.
 */
const _updateReconcileResult = async ({ reconcileResult, unScheduledAlgorithms, ignoredUnScheduledAlgorithms, jobsInfo, normalizedWorkers, normResources, options, containerDefaults }) => {
    const { created, skipped, toStop, toResume } = jobsInfo;
    Object.entries(reconcileResult).forEach(([algorithmName, res]) => {
        res.created = created.filter(c => c.algorithmName === algorithmName).length;
        res.skipped = skipped.filter(c => c.algorithmName === algorithmName).length;
        res.paused = toStop.filter(c => c.algorithmName === algorithmName).length;
        res.resumed = toResume.filter(c => c.algorithmName === algorithmName).length;
    });

    const workerStats = _aggregateWorkerStats(normalizedWorkers);
    const defaultWorkerResources = await _resolveWorkerResourceDefaults(options, containerDefaults);

    await etcd.updateDiscovery({
        reconcileResult,
        unScheduledAlgorithms,
        ignoredUnScheduledAlgorithms,
        actual: workerStats,
        resourcePressure: {
            cpu: consts.CPU_RATIO_PRESSURE,
            gpu: consts.GPU_RATIO_PRESSURE,
            mem: consts.MEMORY_RATIO_PRESSURE
        },
        defaultWorkerResources,
        nodes: _buildNodeStats(normResources, normalizedWorkers)
    });

    workerStats.stats.forEach((ws) => {
        const { algorithmName } = ws;
        if (!reconcileResult[algorithmName]) {
            reconcileResult[algorithmName] = {
                created: 0,
                skipped: 0,
                paused: 0,
                resumed: 0,
                required: 0
            };
        }
        const { created: totalCreated, skipped: totalSkipped, paused: totalPaused, resumed: totalResumed, required: totalRequired } = reconcileResult[algorithmName];
        const total = totalCreated + totalSkipped + totalPaused + totalResumed + totalRequired;
        if (total !== 0) {
            log.info(`_updateReconcileResult - Results for algo ${algorithmName} : created jobs: ${totalCreated}, 
                skipped jobs: ${totalSkipped}, paused workers: ${totalPaused}, 
                resumed workers: ${totalResumed}, required: ${totalRequired}.`, { component });
        }
        reconcileResult[algorithmName].active = ws.count;
    });
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, workers, jobs, versions, normResources, options, registry, clusterOptions, pods, workerResources, containerDefaults } = {}) => {
    // Update the cache of jobs lately created by removing old jobs
    const reconcileResult = {};

    // Clear created jobs list after TTL, and check for resource pressure
    jobsHandler.clearCreatedJobsLists(options.createdJobsTTL);
    _checkResourcePressure(normResources);

    // Create a new instance of workers manager
    const workersManager = new WorkersManager(workers, jobs, pods, algorithmTemplates, versions, registry);

    // Update batch capacity
    const batchCount = workersManager.countBatchWorkers() + jobsHandler.createdJobsLists.batch.length;
    requestPreprocessor.updateCapacity(batchCount);

    // Organise all allocated jobs (all existing k8s jobs, those with worker (each worker has a k8s job) and those appending to a worker) 
    const { jobAttachedWorkers, jobsPendingForWorkers } = workersManager;
    const idleWorkers = workersManager.getIdleWorkers();
    const activeWorkers = workersManager.getActiveWorkers();
    const pausedWorkers = workersManager.getPausedWorkers();
    const bootstrappingWorkers = workersManager.getBootstrappingWorkers();
    const allAllocatedJobs = {
        idleWorkers, activeWorkers, pausedWorkers, bootstrappingWorkers, jobsPendingForWorkers
    };
    // Prepare algorithm requests
    const requests = requestPreprocessor.prepare(algorithmRequests, algorithmTemplates, jobAttachedWorkers, allAllocatedJobs);

    // Handle workers life-cycle
    const workersToExitPromises = workersManager.handleExitWorkers();
    const workersToWarmUpPromises = workersManager.handleWarmUpWorkers();
    const workersToCoolDownPromises = workersManager.handleCoolDownWorkers();

    // Schedule the requests
    const jobsInfo = await jobsHandler.schedule(allAllocatedJobs, algorithmTemplates, normResources, versions,
        requests, registry, clusterOptions, workerResources, options, reconcileResult);

    // Handle workers life-cycle & wait for the promises to resolve
    const { toResume, toStop } = jobsInfo;
    const workersToStopPromises = workersManager.stop(toStop);
    const workersToResumePromises = workersManager.resume(toResume);
    await Promise.all([...workersToStopPromises, ...workersToExitPromises, ...workersToWarmUpPromises, ...workersToCoolDownPromises, ...workersToResumePromises]);
    
    // Write in etcd the reconcile result
    const { normalizedWorkers } = workersManager;
    await _updateReconcileResult({
        reconcileResult, ...jobsHandler, jobsInfo, normalizedWorkers, normResources, options, containerDefaults
    });

    return reconcileResult;
};

module.exports = { reconcile };
