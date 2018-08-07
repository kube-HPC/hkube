const clone = require('lodash.clonedeep');
const parse = require('@hkube/units-converter');
const { CPU_RATIO_PRESURE, MEMORY_RATIO_PRESURE, MAX_JOBS_PER_TICK } = require('../../common/consts/consts');


const shouldAddJob = (jobDetails, availableResources, totalAdded) => {
    if (totalAdded >= MAX_JOBS_PER_TICK) {
        return { shouldAdd: false, newResources: { ...availableResources } };
    }
    const requestedCpu = parse.getCpuInCore('' + jobDetails.resourceRequests.requests.cpu);
    const memoryRequests = parse.getMemoryInMi(jobDetails.resourceRequests.requests.memory);
    if (availableResources.allNodes.free.cpu * CPU_RATIO_PRESURE < requestedCpu) {
        return { shouldAdd: false, newResources: { ...availableResources } };
    }
    if (availableResources.allNodes.free.memory * MEMORY_RATIO_PRESURE < memoryRequests) {
        return { shouldAdd: false, newResources: { ...availableResources } };
    }
    const nowFree = {
        cpu: availableResources.allNodes.free.cpu - requestedCpu,
        memory: availableResources.allNodes.free.memory - memoryRequests
    };
    return { shouldAdd: true, newResources: { ...availableResources, allNodes: { ...availableResources.allNodes, free: nowFree } } };
};

const shouldStopJob = (jobDetails, availableResources) => {
    const requestedCpu = parse.getCpuInCore('' + jobDetails.resourceRequests.requests.cpu);
    const memoryRequests = parse.getMemoryInMi(jobDetails.resourceRequests.requests.memory);
    const isCpuPresure = availableResources.allNodes.ratio.cpu > CPU_RATIO_PRESURE;
    const isMemoryPresure = availableResources.allNodes.ratio.memory > MEMORY_RATIO_PRESURE;
    if (!isCpuPresure && !isMemoryPresure) {
        return { shouldStop: false, newResources: { ...availableResources } };
    }

    const nowFree = {
        cpu: availableResources.allNodes.free.cpu + requestedCpu,
        memory: availableResources.allNodes.free.memory + memoryRequests
    };
    const nowRequests = {
        cpu: availableResources.allNodes.requests.cpu - requestedCpu,
        memory: availableResources.allNodes.requests.memory - memoryRequests
    };
    const nowRatio = {
        cpu: availableResources.allNodes.requests.cpu / availableResources.allNodes.total.cpu,
        memory: availableResources.allNodes.requests.memory / availableResources.allNodes.total.memory,
    };
    return {
        shouldStop: true,
        newResources: {
            ...availableResources,
            allNodes: {
                ...availableResources.allNodes,
                free: nowFree,
                requests: nowRequests,
                ratio: nowRatio
            }
        }
    };
};

const _sortWorkers = (a, b) => {
    if (b.workerPaused > a.workerPaused) {
        return 1;
    }
    if (b.workerStatus === 'ready') {
        return 1;
    }
    return -1;
};

const _findWorkerToStop = (workers, algorithmName) => {
    const workerIndex = workers.slice().sort(_sortWorkers).findIndex(w => w.algorithmName === algorithmName);
    if (workerIndex !== -1) {
        return { worker: workers[workerIndex], workers: workers.filter((w, i) => i !== workerIndex) };
    }
    return { workers };
};

const pauseAccordingToResources = (stopDetails, availableResources, workers) => {
    const localDetails = clone(stopDetails);
    let localWorkers = workers;
    let addedThisTime = 0;

    const toStop = [];
    const skipped = [];
    const cb = (j) => {
        if (j.count > 0) {
            const { shouldStop, newResources } = shouldStopJob(j.details, availableResources);
            if (shouldStop) {
                const workerToStop = _findWorkerToStop(localWorkers, j.details.algorithmName);
                localWorkers = workerToStop.workers;
                if (workerToStop.worker) {
                    toStop.push(workerToStop.worker);
                }
            }
            else {
                skipped.push(j.details);
            }
            j.count -= 1;
            addedThisTime += 1;
            availableResources = newResources;
        }
    };

    do {
        addedThisTime = 0;
        localDetails.forEach(cb);
    } while (addedThisTime > 0);

    return { toStop };
};

const matchJobsToResources = (createDetails, availableResources) => {
    const created = [];
    const skipped = [];
    const localDetails = clone(createDetails);
    let addedThisTime = 0;
    let totalAdded = 0;
    // loop over all the job types one by one and assign until it can't fit in any node
    const cb = (j) => {
        if (j.numberOfNewJobs > 0) {
            const { shouldAdd, newResources } = shouldAddJob(j.jobDetails, availableResources, totalAdded);
            if (shouldAdd) {
                created.push(j.jobDetails);
            }
            else {
                skipped.push(j.jobDetails);
            }
            j.numberOfNewJobs -= 1;
            addedThisTime += 1;
            totalAdded += 1;
            availableResources = newResources;
        }
    };
    do {
        addedThisTime = 0;
        localDetails.forEach(cb);
    } while (addedThisTime > 0);

    return { created, skipped };
};

module.exports = {
    matchJobsToResources,
    shouldAddJob,
    pauseAccordingToResources,
    _sortWorkers
};
