const sumBy = require('lodash.sumby');
const groupBy = require('lodash.groupby');
const parse = require('@hkube/units-converter');
const objectPath = require('object-path');
const { gpuVendors } = require('../consts');
const { setWorkerImage } = require('./createOptions');
const { settings: globalSettings } = require('../helpers/settings');
/**
 * normalizes the worker info from discovery
 * input will look like:
 * <code>
 * {
 *  '/discovery/workers/worker-uuid':{
 *      algorithmName,
 *      workerStatus,
 *      jobStatus,
 *      error
 *      },
 *  '/discovery/workers/worker-uuid2':{
 *      algorithmName,
 *      workerStatus,
 *      jobStatus,
 *      error
 *      }
 * }
 * </code>
 * normalized output should be:
 * <code>
 * {
 *   worker-uuid:{
 *     algorithmName,
 *     workerStatus // ready, working
 * 
 *   }
 * }
 * </code>
 * @param {*} workers 
 */

const normalizeWorkers = (workers) => {
    if (!workers) {
        return [];
    }
    const workersArray = workers.map((w) => {
        return {
            id: w.workerId,
            algorithmName: w.algorithmName,
            workerStatus: w.workerStatus,
            workerPaused: !!w.workerPaused,
            hotWorker: w.hotWorker,
            podName: w.podName,
            workerImage: w.workerImage,
            algorithmImage: w.algorithmImage,
            algorithmVersion: w.algorithmVersion
        };
    });
    return workersArray;
};

/**
 * This method tries to find workers that at least one image (worker/algorithm) 
 * is different from the current image version.
 */
const normalizeWorkerImages = (normWorkers, algorithmTemplates, versions, registry) => {
    const workers = [];
    if (!Array.isArray(normWorkers) || normWorkers.length === 0) {
        return workers;
    }
    normWorkers.filter(w => w.workerStatus !== 'exit').forEach((w) => {
        const algorithm = algorithmTemplates[w.algorithmName];
        if (!algorithm) {
            return;
        }
        if (algorithm.options && algorithm.options.debug) {
            return;
        }

        const workerImage = setWorkerImage({ workerImage: algorithm.workerImage }, versions, registry);

        let message;
        if (workerImage !== w.workerImage) {
            message = 'worker image changed';
        }
        if (algorithm.version && w.algorithmVersion && algorithm.version !== w.algorithmVersion) {
            message = 'algorithm version changed';
        }
        if (message) {
            workers.push({ ...w, message });
        }
    });
    return workers;
};

/**
 * This method tries to fill the missing `minHotWorkers` 
 * for each algorithm request
 */
const normalizeHotRequests = (algorithmRequests, algorithmTemplateStore) => {
    const normRequests = algorithmRequests || [];
    const algorithmTemplates = algorithmTemplateStore || {};
    const algorithmStore = Object.entries(algorithmTemplates).filter(([, v]) => v.minHotWorkers > 0);

    if (algorithmStore.length === 0) {
        return normRequests;
    }
    const requests = [];
    const groupNormRequests = groupBy(normRequests, 'algorithmName');

    algorithmStore.forEach(([k, v]) => {
        const hotWorkers = new Array(v.minHotWorkers).fill({ algorithmName: k, hotWorker: true });
        const groupNor = groupNormRequests[k];
        const requestsPerAlgorithm = (groupNor && groupNor.length) || 0;

        if (requestsPerAlgorithm > v.minHotWorkers) {
            const diff = requestsPerAlgorithm - v.minHotWorkers;
            const array = groupNor.slice(0, diff);
            requests.push(...hotWorkers, ...array);
        }
        else if (requestsPerAlgorithm <= v.minHotWorkers) {
            requests.push(...hotWorkers);
        }
    });
    requests.push(...normRequests.filter(r => !algorithmStore.find(a => a[0] === r.algorithmName)));
    return requests;
};

/**
 * find workers that should transform from cold to hot by calculating 
 * the diff between the current hot workers and desired hot workers.
 */
const normalizeHotWorkers = (normWorkers, algorithmTemplates) => {
    const hotWorkers = [];
    if (!Array.isArray(normWorkers) || normWorkers.length === 0) {
        return hotWorkers;
    }
    const groupNorWorkers = groupBy(normWorkers, 'algorithmName');
    Object.entries(groupNorWorkers).forEach(([k, v]) => {
        const algorithm = algorithmTemplates[k];
        const requestHot = algorithm && algorithm.minHotWorkers;
        const currentHot = v.filter(w => w.hotWorker).length;
        const currentCold = v.filter(w => !w.hotWorker);

        if (currentHot < requestHot && currentCold.length > 0) {
            const array = currentCold.slice(0, requestHot);
            hotWorkers.push(...array);
        }
    });
    return hotWorkers;
};

/**
 * find workers that should transform from hot to cold by calculating 
 * the diff between the current hot workers and desired hot workers.
 */
const normalizeColdWorkers = (normWorkers, algorithmTemplates) => {
    const coldWorkers = [];
    if (!Array.isArray(normWorkers) || normWorkers.length === 0) {
        return coldWorkers;
    }
    const normHotWorkers = normWorkers.filter(w => w.hotWorker);
    const groupNorWorkers = groupBy(normHotWorkers, 'algorithmName');
    Object.entries(groupNorWorkers).forEach(([k, v]) => {
        const algorithm = algorithmTemplates[k];
        const request = (algorithm && algorithm.minHotWorkers) || 0;
        const current = v.length;

        const diff = current - request;
        if (diff > 0) {
            const array = v.slice(0, diff);
            coldWorkers.push(...array);
        }
    });
    return coldWorkers;
};

const normalizeDrivers = (drivers) => {
    if (!drivers) {
        return [];
    }
    const driversArray = drivers.map((d) => {
        return {
            id: d.driverId,
            driverStatus: d.driverStatus,
            paused: !!d.paused,
            podName: d.podName
        };
    });
    return driversArray;
};

const calcRatioFree = (node) => {
    node.ratio = {
        cpu: node.requests.cpu / node.total.cpu,
        gpu: (node.total.gpu && node.requests.gpu / node.total.gpu) || 0,
        memory: node.requests.memory / node.total.memory
    };
    node.free = {
        cpu: node.total.cpu - node.requests.cpu,
        gpu: node.total.gpu - node.requests.gpu,
        memory: node.total.memory - node.requests.memory
    };
};

const _nodeTaintsFilter = (node) => {
    return !(node.spec && node.spec.taints && node.spec.taints.some(t => t.effect === 'NoSchedule'));
};

const parseGpu = (gpu) => {
    if (!gpu || !gpu[gpuVendors.NVIDIA]) {
        return 0;
    }
    return parseFloat(gpu[gpuVendors.NVIDIA]);
};

const _getGpuSpec = (pod) => {
    let limitsGpu = sumBy(pod.spec.containers, c => parseGpu(objectPath.get(c, 'resources.limits', 0)));

    if (!limitsGpu) {
        limitsGpu = parseGpu(objectPath.get(pod, 'metadata.annotations', null));
    }
    const requestGpu = limitsGpu;
    return { limitsGpu, requestGpu };
};

const _getRequestsAndLimits = (pod) => {
    const { useResourceLimits } = globalSettings;
    const limitsCpu = sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.limits.cpu', '0m')));
    const { limitsGpu, requestGpu } = _getGpuSpec(pod);
    const limitsMem = sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.limits.memory', 0)));
    const requestCpu = useResourceLimits && limitsCpu
        ? limitsCpu
        : sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.requests.cpu', '0m')));
    const requestMem = useResourceLimits && limitsMem
        ? limitsMem
        : sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.requests.memory', 0)));
    return {
        requestCpu, requestGpu, requestMem, limitsCpu, limitsGpu, limitsMem
    };
};

const normalizeResources = ({ pods, nodes } = {}) => {
    if (!pods || !nodes) {
        return {
            allNodes: {
                ratio: {
                    cpu: 0,
                    gpu: 0,
                    memory: 0,
                },
                free: {
                    cpu: 0,
                    gpu: 0,
                    memory: 0
                }
            }
        };
    }
    const initial = nodes.body.items.filter(_nodeTaintsFilter).reduce((acc, cur) => {
        acc[cur.metadata.name] = {
            labels: cur.metadata.labels,
            requests: { cpu: 0, gpu: 0, memory: 0 },
            limits: { cpu: 0, gpu: 0, memory: 0 },
            workersTotal: { cpu: 0, gpu: 0, memory: 0 },
            workers: [],
            other: { cpu: 0, gpu: 0, memory: 0 },
            total: {
                cpu: parse.getCpuInCore(cur.status.allocatable.cpu),
                gpu: parseGpu(cur.status.allocatable) || 0,
                memory: parse.getMemoryInMi(cur.status.allocatable.memory)
            }
        };
        return acc;
    }, {});
    const allNodes = {
        requests: { cpu: 0, gpu: 0, memory: 0 },
        limits: { cpu: 0, gpu: 0, memory: 0 },
        total: {
            cpu: sumBy(Object.values(initial), 'total.cpu'),
            gpu: sumBy(Object.values(initial), 'total.gpu'),
            memory: sumBy(Object.values(initial), 'total.memory'),
        }
    };
    const stateFilter = p => p.status.phase === 'Running' || p.status.phase === 'Pending';
    const resourcesPerNode = pods.body.items.filter(stateFilter).reduce((accumulator, pod) => {
        const { nodeName } = pod.spec;
        if (!nodeName || !accumulator[nodeName]) {
            return accumulator;
        }
        const { requestCpu, requestGpu, requestMem, limitsCpu, limitsGpu, limitsMem } = _getRequestsAndLimits(pod);

        accumulator[nodeName].requests.cpu += requestCpu;
        accumulator[nodeName].requests.gpu += requestGpu;
        accumulator[nodeName].requests.memory += requestMem;
        accumulator[nodeName].limits.cpu += limitsCpu;
        accumulator[nodeName].limits.gpu += limitsGpu;
        accumulator[nodeName].limits.memory += limitsMem;
        if (objectPath.get(pod, 'metadata.labels.type') === 'worker') {
            accumulator[nodeName].workersTotal.cpu += requestCpu;
            accumulator[nodeName].workersTotal.gpu += requestGpu;
            accumulator[nodeName].workersTotal.memory += requestMem;
            accumulator[nodeName].workers.push({
                algorithmName: objectPath.get(pod, 'metadata.labels.algorithm-name'),
                nodeName
            });
        }
        else {
            accumulator[nodeName].other.cpu += requestCpu;
            accumulator[nodeName].other.gpu += requestGpu;
            accumulator[nodeName].other.memory += requestMem;
        }

        return accumulator;
    }, initial);

    const nodeList = [];
    Object.entries(resourcesPerNode).forEach(([k, v]) => {
        calcRatioFree(v);
        allNodes.requests.cpu += v.requests.cpu;
        allNodes.requests.gpu += v.requests.gpu;
        allNodes.requests.memory += v.requests.memory;
        allNodes.limits.cpu += v.limits.cpu;
        allNodes.limits.gpu += v.limits.gpu;
        allNodes.limits.memory += v.limits.memory;
        nodeList.push({ name: k, ...v });
    });
    calcRatioFree(allNodes);
    return { allNodes, nodeList };
};

const normalizeRequests = (requests) => {
    if (requests == null || requests.length === 0 || requests[0].data == null) {
        return [];
    }

    return requests[0].data.map(r => ({ algorithmName: r.name }));
};

const normalizeDriversRequests = (requests) => {
    if (requests == null || requests.length === 0 || requests[0].data == null) {
        return [];
    }
    return [{
        name: 'pipeline-driver',
        pods: requests[0].data.filter(r => r.name === 'pipeline-driver').length
    }];
};

const _tryParseTime = (timeString) => {
    if (!timeString) {
        return null;
    }
    try {
        const date = new Date(timeString);
        return date.getTime();
    }
    catch (error) {
        return null;
    }
};

const normalizeJobs = (jobsRaw, pods, predicate = () => true) => {
    if (!jobsRaw || !jobsRaw.body || !jobsRaw.body.items) {
        return [];
    }
    const podsList = objectPath.get(pods, 'body.items', []);
    const jobs = jobsRaw.body.items
        .filter(predicate)
        .map((j) => {
            const pod = podsList.find(p => objectPath.get(p, 'metadata.labels.controller-uid', '') === objectPath.get(j, 'metadata.uid'));
            return {
                name: j.metadata.name,
                algorithmName: j.metadata.labels['algorithm-name'],
                active: j.status.active === 1,
                startTime: _tryParseTime(j.status.startTime),
                podName: objectPath.get(pod, 'metadata.name'),
                nodeName: objectPath.get(pod, 'spec.nodeName'),

            };
        });
    return jobs;
};

const normalizeDriversJobs = (jobsRaw, predicate = () => true) => {
    if (!jobsRaw || !jobsRaw.body || !jobsRaw.body.items) {
        return [];
    }
    const jobs = jobsRaw.body.items
        .filter(predicate)
        .map(j => ({
            name: j.metadata.name,
            active: j.status.active === 1
        }));
    return jobs;
};

const mergeWorkers = (workers, jobs) => {
    const foundJobs = [];
    const mergedWorkers = workers.map((w) => {
        const jobForWorker = jobs.find(j => w.podName && w.podName.startsWith(j.name));
        if (jobForWorker) {
            foundJobs.push(jobForWorker.name);
        }
        return { ...w, job: jobForWorker ? { ...jobForWorker } : undefined };
    });

    const extraJobs = jobs.filter((job) => {
        return !foundJobs.find(j => j === job.name);
    });
    return { mergedWorkers, extraJobs };
};

const normalizeDriversAmount = (jobs, requests, settings) => {
    const { minAmount, maxAmount, name } = settings;
    let amount = minAmount;
    const request = requests[0] || {};

    if (request.pods > minAmount) {
        amount = maxAmount;
    }
    const missingDrivers = amount - jobs.length;
    return { name, pods: missingDrivers };
};

module.exports = {
    normalizeWorkers,
    normalizeWorkerImages,
    normalizeHotRequests,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeDrivers,
    normalizeRequests,
    normalizeDriversRequests,
    normalizeJobs,
    normalizeDriversJobs,
    mergeWorkers,
    normalizeResources,
    normalizeDriversAmount
};
