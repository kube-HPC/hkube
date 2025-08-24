const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const etcd = require('../helpers/etcd');
const { components, consts } = require('../consts');
const component = components.RECONCILER;
const { WorkersManager, requestPreprocessor, jobsHandler } = require('./managers');

const { CPU_RATIO_PRESSURE, MEMORY_RATIO_PRESSURE } = consts;

const _calcStats = (data) => {
    const stats = Object.values(data.reduce((acc, cur) => {
        if (!acc[cur.algorithmName]) {
            acc[cur.algorithmName] = {
                algorithmName: cur.algorithmName,
                count: 0,
                init: 0,
                ready: 0,
                working: 0,
                exit: 0,
                hot: 0
            };
        }
        acc[cur.algorithmName].count += 1;
        if (cur.workerStatus === undefined) {
            acc[cur.algorithmName].redundant = (acc[cur.algorithmName].redundant || 0) + 1;
        }
        else acc[cur.algorithmName][cur.workerStatus] += 1;
        if (cur.hotWorker) {
            acc[cur.algorithmName].hot += 1;
        }
        return acc;
    }, {}));

    return { stats, total: data.length };
};

const _getNodeStats = (normResources, normalizedWorkers) => {
    const localResources = clonedeep(normResources);
    const resourcesWithWorkers = localResources.nodeList;
    const statsPerNode = resourcesWithWorkers.map(n => ({
        name: n.name,
        total: {
            cpu: n.total.cpu,
            gpu: n.total.gpu,
            mem: n.total.memory,

        },
        requests: {
            cpu: n.requests.cpu,
            gpu: n.requests.gpu,
            mem: n.requests.memory,

        },
        other: {
            cpu: n.other.cpu,
            gpu: n.other.gpu,
            mem: n.other.memory,
        },
        workersTotal: {
            cpu: n.workersTotal.cpu,
            gpu: n.workersTotal.gpu,
            mem: n.workersTotal.memory,
        },
        labels: n.labels,
        workers2: n.workers,
        workers: _calcStats(normalizedWorkers.filter(worker => n.workers.some(nWorker => nWorker.podName === worker.podName)))
    }
    ));
    return statsPerNode;
};

const _checkResourcePressure = (normResources) => {
    const isCpuPressure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESSURE;
    const isMemoryPressure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESSURE;
    const isResourcePressure = isCpuPressure || isMemoryPressure;
    if (isResourcePressure) {
        log.trace(`isCpuPressure: ${isCpuPressure}, isMemoryPressure: ${isMemoryPressure}`, { component });
    }
};

const _updateReconcileResult = async ({ reconcileResult, unScheduledAlgorithms, ignoredUnScheduledAlgorithms, jobsInfo, normalizedWorkers, normResources }) => {
    const { created, skipped, toStop, toResume } = jobsInfo;
    Object.entries(reconcileResult).forEach(([algorithmName, res]) => {
        res.created = created.filter(c => c.algorithmName === algorithmName).length;
        res.skipped = skipped.filter(c => c.algorithmName === algorithmName).length;
        res.paused = toStop.filter(c => c.algorithmName === algorithmName).length;
        res.resumed = toResume.filter(c => c.algorithmName === algorithmName).length;
    });

    const workerStats = _calcStats(normalizedWorkers);

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
        nodes: _getNodeStats(normResources, normalizedWorkers)
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

const reconcile = async ({ algorithmTemplates, algorithmRequests, workers, jobs, pods, versions, normResources, registry, options, clusterOptions, workerResources } = {}) => {
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
        reconcileResult, ...jobsHandler, jobsInfo, normalizedWorkers, normResources
    });

    return reconcileResult;
};

module.exports = { reconcile };
