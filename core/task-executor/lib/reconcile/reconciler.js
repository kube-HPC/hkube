const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const etcd = require('../helpers/etcd');
const { components, consts } = require('../consts');
const component = components.RECONCILER;
const { WorkersManager, requestsManager, jobsManager } = require('./managers');

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

const _getNodeStats = (normResources) => {
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
        workers: _calcStats(n.workers)

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

const _updateReconcileResult = async ({ reconcileResult, unScheduledAlgorithms, ignoredUnScheduledAlgorithms, jobsInfo, workerStats, normResources }) => {
    const { created, skipped, toStop, toResume } = jobsInfo;
    Object.entries(reconcileResult).forEach(([algorithmName, res]) => {
        res.created = created.filter(c => c.algorithmName === algorithmName).length;
        res.skipped = skipped.filter(c => c.algorithmName === algorithmName).length;
        res.paused = toStop.filter(c => c.algorithmName === algorithmName).length;
        res.resumed = toResume.filter(c => c.algorithmName === algorithmName).length;
    });

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
        nodes: _getNodeStats(normResources)
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
        const { created: _created, skipped: _skipped, paused, resumed, required } = reconcileResult[algorithmName];
        const total = _created + _skipped + paused + resumed + required;
        if (total !== 0) {
            log.info(`CYCLE: task-executor: algo: ${algorithmName} created jobs: ${_created}, 
                skipped jobs: ${_skipped}, paused workers: ${paused}, 
                resumed workers: ${resumed}, required: ${required}.`, { component });
        }
        reconcileResult[algorithmName].active = ws.count;
    });
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, workers, jobs, pods, versions, normResources, registry, options, clusterOptions, workerResources } = {}) => {
    // Update the cache of jobs lately created by removing old jobs
    const reconcileResult = {};

    jobsManager.clearCreatedJobsLists(options);
    _checkResourcePressure(normResources);

    const workersManager = new WorkersManager(workers, jobs, pods, algorithmTemplates, versions, registry);

    const batchCount = workersManager.countBatchWorkers(algorithmTemplates) + jobsManager.createdJobsLists.batch.length;
    requestsManager.updateCapacity(batchCount);
    requestsManager.prepareAlgorithmRequests(algorithmRequests, algorithmTemplates, workersManager.mergedWorkers, workersManager.categorizedWorkers);

    await jobsManager.finalizeScheduling(workersManager, algorithmTemplates, normResources, requestsManager.maxFilteredRequests,
        versions, requestsManager.finalRequests, registry, clusterOptions, workerResources, options, reconcileResult);
    
    // add created and skipped info
    const workerStats = _calcStats(workersManager.normWorkers);
    await _updateReconcileResult({
        reconcileResult, workerStats, ...jobsManager, normResources
    });

    return reconcileResult;
};

module.exports = {
    reconcile
};
