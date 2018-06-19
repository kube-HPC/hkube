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
    shouldAddJob
};
