const clone = require('lodash.clonedeep');
const parse = require('@hkube/units-converter');
const { warningCodes } = require('@hkube/consts');
const { consts, gpuVendors } = require('../consts');
const { lessWithTolerance } = require('../helpers/compare');
const { settings } = require('../helpers/settings');
const { CPU_RATIO_PRESSURE, GPU_RATIO_PRESSURE, MEMORY_RATIO_PRESSURE, MAX_JOBS_PER_TICK } = consts;
const { createWarning } = require('../utils/warningCreator');

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
 * @param {Object} allVolumes - An object containing all available PVCs, ConfigMaps, and Secrets with their names.
 * @returns {Array<string>} An array of names of missing volumes. If all volumes exist, the array will be empty.
 */
const _getMissingVolumes = (requestedVolumes, allVolumes) => {
    if (!requestedVolumes || requestedVolumes.length === 0) return [];
    const missingVolumes = [];
    requestedVolumes.forEach(volume => {
        if (volume.persistentVolumeClaim) {
            const name = volume.persistentVolumeClaim.claimName;
            if (!allVolumes.pvcs.find(pvcName => pvcName === name)) {
                missingVolumes.push(name);
            }
        }
        if (volume.configMap) {
            const { name } = volume.configMap;
            if (!allVolumes.configMaps.find(configMapName => configMapName === name)) {
                missingVolumes.push(name);
            }
        }
        if (volume.secret) {
            const name = volume.secret.secretName;
            if (!allVolumes.secrets.find(secretName => secretName === name)) {
                missingVolumes.push(name);
            }
        }
    });
    return missingVolumes;
};

/**
 * Applies the configuration from the kaiObject to annotations and labels.
 * 
 * @param {Object} kaiObject - The kaiObject containing the values to apply.
 * @param {string} algorithmName - The name of the algorithm being configured.
 * @param {Object} annotations - The annotations object to modify.
 * @param {Object} labels - The labels object to modify.
 * 
 * @returns {string|undefined} - A string message if 'queue' is missing from kaiObject, otherwise undefined.
 */
const validateKai = ({ kaiObject, algorithmName }) => {
    const { queue } = kaiObject || {};
    if (!queue) {
        return `Missing 'queue' in kaiObject for algorithm "${algorithmName}"`;
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

const shouldAddJob = (jobDetails, availableResources, totalAdded, allVolumes) => {
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
        // const warning = _createWarning(unMatchedNodesBySelector, jobDetails, nodesForSchedule, nodesBySelector.length);
        return { shouldAdd: false, warning, newResources: { ...availableResources } };
    }

    const missingVolumes = _getMissingVolumes(jobDetails.volumes, allVolumes);
    if (missingVolumes.length > 0) {
        const warning = createWarning({ jobDetails, missingVolumes, code: warningCodes.INVALID_VOLUME });
        return {
            shouldAdd: false,
            warning,
            newResources: { ...availableResources }
        };
    }

    if (jobDetails.kaiObject && Object.keys(jobDetails.kaiObject).length > 0) {
        const kaiError = validateKai(jobDetails);
        if (kaiError) {
            const warning = createWarning({ jobDetails, message: kaiError, code: warningCodes.KAI || 1004 });
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

function _scheduleAlgorithmToNode(nodeList, { requestedCpu, requestedGpu, memoryRequests }) {
    const nodeForSchedule = nodeList.find(n => findNodeForSchedule(n, requestedCpu, requestedGpu, memoryRequests, false).available);
    return nodeForSchedule;
}

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

const parseResources = (worker) => {
    const requestedCpu = parse.getCpuInCore('' + worker.resourceRequests.requests.cpu);
    const memoryRequests = parse.getMemoryInMi(worker.resourceRequests.requests.memory);
    const requestedGpu = worker.resourceRequests.requests[gpuVendors.NVIDIA] || 0;

    return { requestedCpu, memoryRequests, requestedGpu };
};

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

const matchWorkersToNodes = (nodeList, workers) => {
    return nodeList.map(n => ({
        ...n,
        workers: workers.filter(w => w.nodeName === n.name)
    }));
};

const pauseAccordingToResources = (stopDetails, availableResources, skippedRequests) => {
    const toStop = [];
    if (stopDetails.length === 0) {
        return { toStop };
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

    return { toStop };
};

const matchJobsToResources = (createDetails, availableResources, scheduledRequests = [], allVolumes) => {
    const requested = [];
    const skipped = [];
    const localDetails = clone(createDetails);
    let addedThisTime = 0;
    let totalAdded = 0;
    // loop over all the job types one by one and assign until it can't fit in any node
    const cb = (j) => {
        if (j.numberOfNewJobs > 0) {
            const { shouldAdd, warning, newResources, node } = shouldAddJob(j.jobDetails, availableResources, totalAdded, allVolumes);
            if (shouldAdd) {
                const toCreate = { ...j.jobDetails, createdTime: Date.now(), node };
                requested.push(toCreate);
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

    return { requested, skipped };
};

module.exports = {
    nodeSelectorFilter,
    matchJobsToResources,
    shouldAddJob,
    pauseAccordingToResources,
    matchWorkersToNodes,
    parseResources
};
