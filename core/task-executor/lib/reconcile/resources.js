const clone = require('lodash.clonedeep');
const parse = require('@hkube/units-converter');
const { warningCodes } = require('@hkube/consts');
const { consts, gpuVendors } = require('../consts');
const { lessWithTolerance } = require('../helpers/compare');
const { settings } = require('../helpers/settings');
const { CPU_RATIO_PRESSURE, GPU_RATIO_PRESSURE, MEMORY_RATIO_PRESSURE, MAX_JOBS_PER_TICK } = consts;
const { createWarning } = require('../utils/warningCreator');

/**
 * Checks if a node can fit the requested resources.
 *
 * Applies resource pressure limits if enabled, then determines
 * if CPU, memory, and GPU requests can be satisfied.
 *
 * @param {Object} node - Node resource object with `total` and `free` properties.
 * @param {number} requestedCpu - Requested CPU cores.
 * @param {number} requestedGpu - Requested GPUs.
 * @param {number} requestedMemory - Requested memory in Mi.
 * @param {boolean} [useResourcePressure=true] - Whether to apply resource pressure limits.
 * @returns {Object} Scheduling result with availability, capacity limits, and missing amounts.
 */
const findNodeForSchedule = (node, requestedCpu, requestedGpu, requestedMemory, useResourcePressure = true) => {
    let freeCpu;
    let freeGpu;
    let freeMemory;
    let totalCpu;
    let totalGpu;
    let totalMemory;

    if (useResourcePressure) {
        totalCpu = node.total.cpu * CPU_RATIO_PRESSURE;
        totalGpu = node.total.gpu * GPU_RATIO_PRESSURE;
        totalMemory = node.total.memory * MEMORY_RATIO_PRESSURE;
        freeCpu = node.free.cpu - (node.total.cpu * (1 - CPU_RATIO_PRESSURE));
        freeGpu = node.free.gpu - (node.total.gpu * (1 - GPU_RATIO_PRESSURE));
        freeMemory = node.free.memory - (node.total.memory * (1 - MEMORY_RATIO_PRESSURE));
    }
    else {
        totalCpu = node.total.cpu;
        totalGpu = node.total.gpu;
        totalMemory = node.total.memory;
        freeCpu = node.free.cpu;
        freeGpu = node.free.gpu;
        freeMemory = node.free.memory;
    }

    // Check if requested resources fit within availble resources.
    const hasSufficientCpu = requestedCpu < freeCpu;
    const hasSufficientMemory = requestedMemory < freeMemory;
    const hasSufficientGpu = requestedGpu === 0 || lessWithTolerance(requestedGpu, freeGpu);

    // Check if requested resources exceed node's max capacity.
    const exceedsCpuMaxCapacity = requestedCpu > totalCpu;
    const exceedsMemMaxCapacity = requestedMemory > totalMemory;
    const exceedsGpuMaxCapacity = requestedGpu > 0 && lessWithTolerance(totalGpu, requestedGpu);

    // log the amount of missing capacity per resource.
    let missingCpu;
    let missingMem;
    let missingGpu;

    if (!hasSufficientCpu) {
        missingCpu = requestedCpu - freeCpu;
        missingCpu = missingCpu.toFixed(2);
    }
    if (!hasSufficientMemory) {
        missingMem = requestedMemory - freeMemory;
        missingMem = missingMem.toFixed(2);
    }
    if ((requestedGpu > 0) && !hasSufficientGpu) {
        missingGpu = requestedGpu - freeGpu;
        missingGpu = missingGpu.toFixed(2);
    }

    return {
        node,
        available: hasSufficientCpu && hasSufficientMemory && hasSufficientGpu,
        maxCapacity: { cpu: exceedsCpuMaxCapacity, mem: exceedsMemMaxCapacity, gpu: exceedsGpuMaxCapacity },
        details: { cpu: hasSufficientCpu, mem: hasSufficientMemory, gpu: hasSufficientGpu },
        amountsMissing: { cpu: missingCpu || 0, mem: missingMem || 0, gpu: missingGpu || 0 }
    };
};

/**
 * Checks if a node matches the given nodeSelector.
 *
 * @param {Object} labels - Node labels as key-value pairs.
 * @param {Object} nodeSelector - Required nodeSelector key-value mapping.
 * @returns {boolean} True if labels match the selector, false otherwise.
 */
const nodeSelectorFilter = (labels, nodeSelector) => {
    let matched = true;
    if (!nodeSelector) {
        return true;
    }
    if (!labels) {
        return false;
    }
    Object.entries(nodeSelector).forEach(([k, v]) => {
        if (Array.isArray(v)) {
            matched = v.includes(labels[k]);
        }
        else if (labels[k] !== v) {
            matched = false;
        }
    });
    return matched;
};

/**
 * Checks the availability of volumes.
 * 
 * This method checks whether each volume (PVC, ConfigMap, or Secret) in requested volumes exists based on the provided list of all available volumes.
 * It returns an array of names of volumes that do not exist.
 * 
 * @param {Array<Object>} requestedVolumes - An array of requested volumes.
 * Each volume can have `persistentVolumeClaim`, `configMap`, or `secret` properties.
 * @param {Object} allVolumesNames - An object containing all available PVCs, ConfigMaps, and Secrets with their names.
 * @returns {Array<string>} An array of names of missing volumes. If all volumes exist, the array will be empty.
 */
const _getMissingVolumes = (requestedVolumes, allVolumesNames) => {
    if (!requestedVolumes || requestedVolumes.length === 0) return [];
    const missingVolumes = [];
    requestedVolumes.forEach(volume => {
        if (volume.persistentVolumeClaim) {
            const name = volume.persistentVolumeClaim.claimName;
            if (!allVolumesNames.pvcs.find(pvcName => pvcName === name)) {
                missingVolumes.push(name);
            }
        }
        if (volume.configMap) {
            const { name } = volume.configMap;
            if (!allVolumesNames.configMaps.find(configMapName => configMapName === name)) {
                missingVolumes.push(name);
            }
        }
        if (volume.secret) {
            const name = volume.secret.secretName;
            if (!allVolumesNames.secrets.find(secretName => secretName === name)) {
                missingVolumes.push(name);
            }
        }
    });
    return missingVolumes;
};

/**
 * Validates the kaiObject configuration for a given algorithm by checking the presence
 * and validity of the specified queue against existing Kai queue names.
 * 
 * @param {Object} params
 * @param {Object} params.kaiObject - The kaiObject containing the configuration values.
 * @param {string} params.algorithmName - The name of the algorithm being validated.
 * @param {string[]} existingQueuesNames - List of valid Kai queue names to check against.
 * 
 * @returns {string|undefined} - A string error message if validation fails, otherwise undefined.
 */
const validateKaiQueue = ({ kaiObject, algorithmName }, existingQueuesNames) => {
    const { queue } = kaiObject || {};
    
    if (!queue) {
        const message = `Missing 'queue' in kaiObject for algorithm "${algorithmName}"`;
        return { message };
    }

    if (!existingQueuesNames.includes(queue)) {
        const message = `Queue "${queue}" in kaiObject for algorithm "${algorithmName}" does not exist in available Kai queues`;
        const isError = true;
        return { message, isError };
    }

    return undefined;
};

/**
 * Calculates the total requested CPU and memory from all containers.
 * 
 * @param {Object} params - The job details, containing the resource details.
 * @param {Object} params.resourceRequests - The algorunner resource requests.
 * @param {Object} params.workerResourceRequests - The worker resource requests.
 * @param {Object} [params.workerCustomResources] - The optional custom worker resource requests.
 * @param {Object} [params.sideCars] - The optional sidecar container.
 * @param {Object} [params.sideCars.container] - The container inside the sidecar.
 * @param {Object} [params.sideCars.container.resources] - The resource requests of the sidecar container.
 * @returns {Object} An object containing the total requested CPU and memory.
 * @returns {number} return.requestedCpu - The total requested CPU in cores.
 * @returns {number} return.requestedMemory - The total requested memory in MiB.
 */
const getAllRequested = ({ resourceRequests, workerResourceRequests, workerCustomResources, sideCars }) => {
    const sideCarResources = sideCars?.map(sideCar => sideCar?.container?.resources) || [];
    const workerRequestedCPU = settings.applyResources ? workerResourceRequests.requests.cpu : '0';
    const workerRequestedMemory = settings.applyResources ? workerResourceRequests.requests.memory : '0Mi';

    const requestedCpu = parse.getCpuInCore(resourceRequests?.requests?.cpu || '0')
        + parse.getCpuInCore(workerCustomResources?.requests?.cpu || workerRequestedCPU)
        + sideCarResources.reduce((acc, resources) => acc + parse.getCpuInCore(resources?.requests?.cpu || '0'), 0);

    const requestedMemory = parse.getMemoryInMi(resourceRequests?.requests?.memory || '0Mi')
        + parse.getMemoryInMi(workerCustomResources?.requests?.memory || workerRequestedMemory)
        + sideCarResources.reduce((acc, resources) => acc + parse.getMemoryInMi(resources?.requests?.memory || '0Mi'), 0);

    return { requestedCpu, requestedMemory };
};

/**
 * Determines whether a job can be added to the schedule.
 *
 * Validates resource availability, missing volumes, KAI object constraints,
 * and applies nodeSelector filtering. Generates warnings when job cannot be scheduled.
 *
 * @param {Object} jobDetails - Job details including resource requests, volumes, etc.
 * @param {Object} availableResources - Current cluster resource state.
 * @param {number} totalAdded - Number of jobs added so far this tick.
 * @param {Object} [extraResources] - Additional metadata such as volumes and queues.
 * @returns {Object} Scheduling decision with `shouldAdd`, optional `warning`, and updated resources.
 */
const shouldAddJob = (jobDetails, availableResources, totalAdded, extraResources) => {
    const { allVolumesNames, existingQueuesNames } = extraResources || {};
    if (totalAdded >= MAX_JOBS_PER_TICK) {
        return { shouldAdd: false, newResources: { ...availableResources } };
    }
    const { requestedCpu, requestedMemory } = getAllRequested(jobDetails);
    const requestedGpu = jobDetails.resourceRequests.requests[gpuVendors.NVIDIA] || 0;
    const nodesBySelector = availableResources.nodeList.filter(n => nodeSelectorFilter(n.labels, jobDetails.nodeSelector));
    const nodesForSchedule = nodesBySelector.map(r => findNodeForSchedule(r, requestedCpu, requestedGpu, requestedMemory));

    const availableNode = nodesForSchedule.find(n => n.available);
    if (!availableNode) {
        // Number of total nodes that don't fit the attribute under nodeSelector
        const unMatchedNodesBySelector = availableResources.nodeList.length - nodesBySelector.length;
        const warning = createWarning({
            unMatchedNodesBySelector,
            jobDetails,
            nodesForSchedule,
            nodesAfterSelector: nodesBySelector.length,
            code: warningCodes.RESOURCES
        });
        return { shouldAdd: false, warning, newResources: { ...availableResources } };
    }

    const missingVolumes = _getMissingVolumes(jobDetails.volumes, allVolumesNames);
    if (missingVolumes.length > 0) {
        const warning = createWarning({ jobDetails, missingVolumes, code: warningCodes.INVALID_VOLUME });
        return {
            shouldAdd: false,
            warning,
            newResources: { ...availableResources }
        };
    }

    if (jobDetails.kaiObject && Object.keys(jobDetails.kaiObject).length > 0) {
        const kaiError = validateKaiQueue(jobDetails, existingQueuesNames);
        if (kaiError) {
            const warning = createWarning({ jobDetails, ...kaiError, code: warningCodes.KAI });
            return {
                shouldAdd: false,
                warning,
                newResources: { ...availableResources }
            };
        }
    }

    const nodeForSchedule = availableNode.node;
    nodeForSchedule.free.cpu -= requestedCpu;
    nodeForSchedule.free.gpu -= requestedGpu;
    nodeForSchedule.free.memory -= requestedMemory;

    return { shouldAdd: true, node: nodeForSchedule.name, newResources: { ...availableResources, allNodes: { ...availableResources.allNodes } } };
};

/**
 * Finds a node that can run the requested algorithm without resource pressure.
 *
 * @param {Object[]} nodeList - List of node resource objects.
 * @param {Object} requests - Requested CPU, GPU, and memory values.
 * @param {number} requests.requestedCpu - Requested CPU cores.
 * @param {number} requests.requestedGpu - Requested GPUs.
 * @param {number} requests.memoryRequests - Requested memory in Mi.
 * @returns {Object|undefined} Matching node or undefined if none found.
 */
function _scheduleAlgorithmToNode(nodeList, { requestedCpu, requestedGpu, memoryRequests }) {
    const nodeForSchedule = nodeList.find(n => findNodeForSchedule(n, requestedCpu, requestedGpu, memoryRequests, false).available);
    return nodeForSchedule;
}

/**
 * Subtracts requested resources from a node's free/requested/ratio values.
 *
 * @param {Object} resources - Node resource object to modify.
 * @param {Object} requests - Resource amounts to subtract.
 */
const _subtractResources = (resources, { requestedCpu, memoryRequests, requestedGpu }) => {
    if (resources.free) {
        resources.free = {
            cpu: resources.free.cpu + requestedCpu,
            memory: resources.free.memory + memoryRequests,
            gpu: resources.free.gpu + requestedGpu
        };
    }
    if (resources.requests) {
        resources.requests = {
            cpu: resources.requests.cpu - requestedCpu,
            memory: resources.requests.memory - memoryRequests,
            gpu: resources.requests.gpu - requestedGpu
        };
    }
    if (resources.ratio) {
        resources.ratio = {
            cpu: resources.requests.cpu / resources.total.cpu,
            memory: resources.requests.memory / resources.total.memory,
            gpu: resources.total.gpu ? resources.requests.gpu / resources.total.gpu : 0
        };
    }
};

/**
 * Parses a worker's resource requests into numeric CPU, memory, and GPU values.
 *
 * @param {Object} worker - Worker with resourceRequests property.
 * @returns {Object} Parsed resources { requestedCpu, memoryRequests, requestedGpu }.
 */
const parseResources = (worker) => {
    const requestedCpu = parse.getCpuInCore('' + worker.resourceRequests.requests.cpu);
    const memoryRequests = parse.getMemoryInMi(worker.resourceRequests.requests.memory);
    const requestedGpu = worker.resourceRequests.requests[gpuVendors.NVIDIA] || 0;

    return { requestedCpu, memoryRequests, requestedGpu };
};

/**
 * Updates a node's resources in a node list by subtracting the given amounts.
 *
 * @param {Object[]} nodeList - Array of node resource objects.
 * @param {string} nodeName - Name of the node to update.
 * @param {Object} requests - Resource amounts to subtract.
 * @returns {Object[]} Updated copy of nodeList.
 */
const _updateNodeResources = (nodeList, nodeName, { requestedCpu, requestedGpu, memoryRequests }) => {
    const nodeListLocal = nodeList.slice();
    const nodeIndex = nodeListLocal.findIndex(n => n.name === nodeName);
    if (nodeIndex === -1) {
        return nodeListLocal;
    }
    const node = clone(nodeListLocal[nodeIndex]);
    _subtractResources(node, { requestedCpu, memoryRequests, requestedGpu });

    nodeListLocal[nodeIndex] = node;
    return nodeListLocal;
};

/**
 * Attempts to free resources by finding a worker to stop until the requested
 * algorithm can be scheduled on a node.
 *
 * @param {Object[]} nodeList - List of nodes.
 * @param {string} algorithmName - Name of the algorithm to schedule.
 * @param {Object} resources - Requested resources for scheduling.
 * @returns {Object} Updated nodeList and workers to stop.
 */
const _findWorkersToStop = (nodeList, algorithmName, resources) => {
    let nodeListLocal = clone(nodeList);
    let workersToStop;
    const foundAny = nodeListLocal.some((n) => {
        let foundNode = null;
        const workers = n.workers.filter(w => w.algorithmName !== algorithmName);
        while (workers.length) {
            workersToStop = [];
            const worker = workers.shift();
            const { requestedCpu, requestedGpu, memoryRequests } = parseResources(worker);
            nodeListLocal = _updateNodeResources(nodeListLocal, n.name, { requestedCpu, requestedGpu, memoryRequests });
            workersToStop.push(worker);
            foundNode = _scheduleAlgorithmToNode(nodeListLocal, resources);
            if (foundNode) {
                break;
            }
        }
        if (!foundNode) {
            nodeListLocal = clone(nodeList);
        }
        return foundNode;
    });
    if (foundAny) {
        return {
            nodeList: nodeListLocal,
            workersToStop
        };
    }
    return {
        nodeList
    };
};

/**
 * Matches workers to the nodes they are running on.
 *
 * @param {Object[]} nodeList - List of node objects.
 * @param {Object[]} workers - List of worker objects.
 * @returns {Object[]} Nodes with `workers` array populated.
 */
const matchWorkersToNodes = (nodeList, workers) => {
    return nodeList.map(n => ({
        ...n,
        workers: workers.filter(w => w.nodeName === n.name)
    }));
};

/**
 * Decides which workers to pause to free up resources for pending jobs.
 *
 * Iterates over skipped requests, tries to stop non-matching workers to
 * make space, and returns workers to stop.
 *
 * @param {Object[]} stopDetails - Workers that can be stopped.
 * @param {Object} availableResources - Cluster resource state.
 * @param {Object[]} skippedRequests - Jobs that were skipped due to lack of resources.
 * @returns {Object[]} List of workers to stop.
 */
const pauseAccordingToResources = (stopDetails, availableResources, skippedRequests) => {
    const toStop = [];
    if (stopDetails.length === 0) {
        return toStop;
    }
    let localDetails = stopDetails.map(sd => sd.details);
    const localResources = clone(availableResources);
    skippedRequests.forEach((r) => {
        const { requestedCpu, requestedGpu, memoryRequests } = parseResources(r);

        // select just the nodes that match this request. sort from largest free space to smalles
        let nodeList = localResources.nodeList.filter(n => nodeSelectorFilter(n.labels, r.nodeSelector)).sort((a, b) => b.free.cpu - a.free.cpu);
        nodeList = matchWorkersToNodes(nodeList, localDetails);
        const workersToStopData = _findWorkersToStop(nodeList, r.algorithmName, { requestedCpu, requestedGpu, memoryRequests });
        if (workersToStopData.workersToStop) {
            nodeList = workersToStopData.nodeList; //eslint-disable-line
            localResources.nodeList.forEach((node) => {
                const newNode = nodeList.find(n => n.name === node.name);
                if (newNode) {
                    node.free = newNode.free;
                    node.requests = newNode.requests;
                    node.gpu = newNode.gpu;
                }
            });
            workersToStopData.workersToStop.forEach(w => toStop.push(w));
            localDetails = localDetails.filter(d => !workersToStopData.workersToStop.find(w => d.id === w.id));
        }
    });

    return toStop;
};

/**
 * Matches jobs to available resources, scheduling as many as possible
 * until no additional jobs can be placed in the current tick.
 *
 * @param {Object[]} createDetails - Details of jobs to create.
 * @param {Object} availableResources - Current cluster resource state.
 * @param {Object[]} [scheduledRequests=[]] - Already scheduled requests.
 * @param {Object} [extraResources] - Additional metadata for scheduling checks.
 * @returns {Object} { requested: jobs scheduled, skipped: jobs not scheduled }
 */
const matchJobsToResources = (createDetails, availableResources, scheduledRequests = [], extraResources) => {
    const jobsToRequest = [];
    const skipped = [];
    const localDetails = clone(createDetails);
    let addedThisTime = 0;
    let totalAdded = 0;
    // loop over all the job types one by one and assign until it can't fit in any node
    const cb = (j) => {
        if (j.numberOfNewJobs > 0) {
            const { shouldAdd, warning, newResources, node } = shouldAddJob(j.jobDetails, availableResources, totalAdded, extraResources);
            if (shouldAdd) {
                const toCreate = { ...j.jobDetails, createdTime: Date.now(), node };
                jobsToRequest.push(toCreate);
                scheduledRequests.push({ algorithmName: toCreate.algorithmName });
            }
            else {
                skipped.push({ ...j.jobDetails, warning });
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

    return { jobsToRequest, skipped };
};

module.exports = {
    nodeSelectorFilter,
    matchJobsToResources,
    shouldAddJob,
    pauseAccordingToResources,
    matchWorkersToNodes,
    parseResources
};
