const clone = require('lodash.clonedeep');
const parse = require('@hkube/units-converter');
const { warningCodes } = require('@hkube/consts');
const { consts, gpuVendors } = require('../consts');
const { lessWithTolerance } = require('../helpers/compare');
const { CPU_RATIO_PRESSURE, GPU_RATIO_PRESSURE, MEMORY_RATIO_PRESSURE, MAX_JOBS_PER_TICK } = consts;

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
        freeCpu = node.free.cpu;
        freeGpu = node.free.gpu;
        freeMemory = node.free.memory;
    }

    const cpu = requestedCpu < freeCpu;
    const mem = requestedMemory < freeMemory;
    const gpu = requestedGpu === 0 || lessWithTolerance(requestedGpu, freeGpu);

    const cpuMaxCapacity = requestedCpu > totalCpu;
    const memMaxCapacity = requestedMemory > totalMemory;
    const gpuMaxCapacity = requestedGpu > 0 && lessWithTolerance(totalGpu, requestedGpu);
    // log the amount of missing capacity per resource.
    let missingCpu;
    let missingMem;
    let missingGpu;
    if (!cpu) {
        missingCpu = requestedCpu - freeCpu;
        missingCpu = missingCpu.toFixed(2);
    }
    if (!mem) {
        missingMem = requestedMemory - freeMemory;
        missingMem = missingMem.toFixed(2);
    }
    if ((requestedGpu > 0) && !gpu) {
        missingGpu = requestedGpu - freeGpu;
        missingGpu = missingGpu.toFixed(2);
    }

    return {
        node,
        available: cpu && mem && gpu,
        maxCapacity: { cpu: cpuMaxCapacity, mem: memMaxCapacity, gpu: gpuMaxCapacity },
        details: { cpu, mem, gpu },
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

const _createWarning = (unMatchedNodesBySelector, jobDetails, nodesForSchedule, nodesAfterSelector) => {
    const messages = [];
    let ns;
    let complexResourceDescriptor;
    if (unMatchedNodesBySelector) {
        ns = Object.entries(jobDetails.nodeSelector).map(([k, v]) => `${k}=${v}`); // Key value array of selectors
        complexResourceDescriptor = {
            ...complexResourceDescriptor,
            requestedSelectors: ns,
            numUnmatchedNodesBySelector: unMatchedNodesBySelector
        };
    } // Handle selector info, and update info for the complexResourceDescriptor
    if (!nodesAfterSelector) {
        messages.push(`No nodes available for scheduling due to selector condition - '${ns.join(',')}'`);
    }
    
    let hasMaxCapacity = true;
    const resourcesMap = Object.create(null);
    const maxCapacityMap = Object.create(null);

    const nodes = [];
    nodesForSchedule.forEach(n => {
        // let nodeIndex = -1;
        let currentNode = {nodeName: n.node.name, amountsMissing: n.amountsMissing};
        const maxCapacity = Object.entries(n.maxCapacity).filter(([, v]) => v === true);
        if (maxCapacity.length === 0) {
            hasMaxCapacity = false;
        }
        maxCapacity.forEach(([k]) => {
            if (!maxCapacityMap[k]) {
                maxCapacityMap[k] = 0;
            }
            maxCapacityMap[k] += 1;
        });
        if (maxCapacity) {
            currentNode = {
                ...currentNode,
                requestsOverMaxCapacity: maxCapacity
            };         
        } // if requests exceed max capacity, add the array containing mem, cpu, gpu.
        const nodeMissingResources = Object.entries(n.details).filter(([, v]) => v === false);
        nodeMissingResources.forEach(([k]) => {
            if (!resourcesMap[k]) {
                resourcesMap[k] = 0;
            }
            resourcesMap[k] += 1;
        });
        nodes.push(currentNode);
    });
    // Valid node's total resource is lower than requested
    if (hasMaxCapacity && Object.keys(maxCapacityMap).length > 0) {
        const maxCapacity = Object.entries(maxCapacityMap).map(([k, v]) => `${k} (${v})`);
        messages.push(`Maximum capacity exceeded ${maxCapacity.join(' ')}`);
    }
    // Not enough resources in valid node
    else if (Object.keys(resourcesMap).length > 0) {
        const resources = Object.entries(resourcesMap).map(([k, v]) => `${k} (${v})`);
        messages.push(`Insufficient ${resources.join(', ')}`);
    }
    complexResourceDescriptor = {
        ...complexResourceDescriptor,
        nodes,
    };
    const warning = {
        algorithmName: jobDetails.algorithmName,
        type: 'warning',
        reason: 'failedScheduling',
        hasMaxCapacity,
        message: messages.join(', '),
        timestamp: Date.now(),
        complexResourceDescriptor,
        requestedResources: jobDetails.resourceRequests.requests,
        code: warningCodes.RESOURCES
    };
    return warning;
};

/**
 * Checks the availability of volumes in sidecar containers.
 * 
 * This method checks whether each volume (PVC, ConfigMap, or Secret) in the sidecar containers exists based on the provided list of all available volumes.
 * It returns an array of names of volumes that do not exist.
 * 
 * @param {Array<Object>} sideCars - An array of sidecar containers.
 * Each sidecar object must contain a `volume` field, which can have `persistentVolumeClaim`, `configMap`, or `secret` properties.
 * @param {Object} allVolumes - An object containing all available PVCs, ConfigMaps, and Secrets with their names.
 * @returns {Array<string>} An array of names of missing volumes. If all volumes exist, the array will be empty.
 */
const _getMissingSideCarVolumes = (sideCars, allVolumes) => {
    if (!sideCars || sideCars.length === 0) return [];
    const missingVolumes = [];
    sideCars.forEach(sideCar => {
        const { volumes } = sideCar;
        if (volumes) {
            volumes.forEach(volume => {
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
        }
    });
    return missingVolumes;
};

const shouldAddJob = (jobDetails, availableResources, totalAdded, allVolumes) => {
    if (totalAdded >= MAX_JOBS_PER_TICK) {
        return { shouldAdd: false, newResources: { ...availableResources } };
    }
    const requestedCpu = parse.getCpuInCore('' + jobDetails.resourceRequests.requests.cpu);
    const requestedGpu = jobDetails.resourceRequests.requests[gpuVendors.NVIDIA] || 0;
    const requestedMemory = parse.getMemoryInMi(jobDetails.resourceRequests.requests.memory);
    const nodesBySelector = availableResources.nodeList.filter(n => nodeSelectorFilter(n.labels, jobDetails.nodeSelector));
    const nodesForSchedule = nodesBySelector.map(r => findNodeForSchedule(r, requestedCpu, requestedGpu, requestedMemory));

    const availableNode = nodesForSchedule.find(n => n.available);
    if (!availableNode) {
        // Number of total nodes that don't fit the attribute under nodeSelector
        const unMatchedNodesBySelector = availableResources.nodeList.length - nodesBySelector.length;
        const warning = _createWarning(unMatchedNodesBySelector, jobDetails, nodesForSchedule, nodesBySelector.length);
        return { shouldAdd: false, warning, newResources: { ...availableResources } };
    }

    const missingSideCarVolumes = _getMissingSideCarVolumes(jobDetails.sideCars, allVolumes);
    if (missingSideCarVolumes.length > 0) {
        const warning = {
            algorithmName: jobDetails.algorithmName,
            type: 'warning',
            reason: 'failedScheduling',
            message: `One or more sideCar volumes are missing or do not exist.\nMissing volumes: ${missingSideCarVolumes.join(', ')}`,
            timestamp: Date.now(),
            sidecarVolumes: missingSideCarVolumes,
            code: warningCodes.INVALID_VOLUME
        };

        return {
            shouldAdd: false,
            warning,
            newResources: { ...availableResources }
        };
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
    const created = [];
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
                created.push(toCreate);
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

    return { created, skipped };
};

module.exports = {
    nodeSelectorFilter,
    matchJobsToResources,
    shouldAddJob,
    pauseAccordingToResources,
    matchWorkersToNodes,
    parseResources
};
