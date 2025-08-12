const sumBy = require('lodash.sumby');
const groupBy = require('lodash.groupby');
const parse = require('@hkube/units-converter');
const objectPath = require('object-path');
const { gpuVendors } = require('../consts');
const { setWorkerImage } = require('./createOptions');
const { settings: globalSettings } = require('../helpers/settings');

/**
 * Normalizes raw worker objects from etcd into a simplified structure.
 * Removes unnecessary fields and keeps only relevant worker attributes.
 *
 * @param {Object[]} workers - Raw workers array from etcd.
 * @returns {Object[]} Normalized workers array.
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
 * Identifies workers that should exit due to changes in image or algorithm version.
 * Adds a `message` property if applicable.
 *
 * @param {Object[]} normalizedWorkers - Normalized worker objects.
 * @param {Object} algorithmTemplates - Algorithm templates from DB.
 * @param {Object} versions - System versions object.
 * @param {Object} registry - Registry configuration.
 * @returns {Object[]} Workers that must exit.
 */
const normalizeWorkerImages = (normalizedWorkers, algorithmTemplates, versions, registry) => {
    const workers = [];
    if (!Array.isArray(normalizedWorkers) || normalizedWorkers.length === 0) {
        return workers;
    }
    normalizedWorkers.filter(w => w.workerStatus !== 'exit').forEach((w) => {
        const algorithm = algorithmTemplates[w.algorithmName];
        if (!algorithm) {
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
const normalizeHotRequestsByType = (algorithmRequests, algorithmTemplateStore, requestTypes) => {
    const normRequests = algorithmRequests || [];
    const algorithmTemplates = algorithmTemplateStore || {};

    const algorithmStore = Object.entries(algorithmTemplates).filter(([, alg]) => {
        const stateType = alg.stateType ? alg.stateType.toLowerCase() : 'batch';
        return alg.minHotWorkers > 0 && (requestTypes ? requestTypes.includes(stateType) : stateType === 'batch');
    });

    if (algorithmStore.length === 0) {
        return normRequests;
    }
    const requests = [];
    const groupNormRequests = groupBy(normRequests, 'algorithmName');

    algorithmStore.forEach(([algName, algTemplate]) => {
        const requestType = algTemplate.stateType ? algTemplate.stateType.toLowerCase() : 'batch';
        const hotWorkers = new Array(algTemplate.minHotWorkers).fill({ algorithmName: algName, hotWorker: true, requestType });
        const groupNor = groupNormRequests[algName];
        const requestsPerAlgorithm = (groupNor && groupNor.length) || 0;

        if (requestsPerAlgorithm > algTemplate.minHotWorkers) {
            const diff = requestsPerAlgorithm - algTemplate.minHotWorkers;
            const array = groupNor.slice(0, diff);
            requests.push(...hotWorkers, ...array);
        }
        else if (requestsPerAlgorithm <= algTemplate.minHotWorkers) {
            requests.push(...hotWorkers);
        }
    });
    requests.push(...normRequests.filter(r => !algorithmStore.find(a => a[0] === r.algorithmName)));
    return requests;
};

/**
 * Finds workers that should transform from cold to hot by calculating 
 * the diff between the current hot workers and desired hot workers.
 *
 * @param {Object[]} normWorkers - Normalized workers array.
 * @param {Object} algorithmTemplates - Algorithm templates from DB.
 * @returns {Object[]} Workers to warm up.
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
 * Finds workers that should transform from hot to cold by calculating 
 * the diff between the current hot workers and desired hot workers.
 *
 * @param {Object[]} jobAttachedWorkers - Workers linked to jobs.
 * @param {Object} algorithmTemplates - Algorithm templates from DB.
 * @returns {Object[]} Workers to cool down.
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

const calcRatioFree = (node) => {
    node.ratio = {
        cpu: node.requests.cpu / node.total.cpu,
        gpu: (node.total.gpu && node.requests.gpu / node.total.gpu) || 0,
        memory: node.requests.memory / node.total.memory
    };
    node.free = {
        cpu: Math.max(0, node.total.cpu - node.requests.cpu),
        gpu: Math.max(0, node.total.gpu - node.requests.gpu),
        memory: Math.max(0, node.total.memory - node.requests.memory)
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
    const limitsMem = sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.limits.memory', 0), true));
    const requestCpu = useResourceLimits && limitsCpu
        ? limitsCpu
        : sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.requests.cpu', '0m')));
    const requestMem = useResourceLimits && limitsMem
        ? limitsMem
        : sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.requests.memory', 0), true));
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
            },
            nodeList: []
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
                memory: parse.getMemoryInMi(cur.status.allocatable.memory, true)
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

/**
 * Normalize raw algorithm requests by extracting algorithm names and their request types.
 *
 * @param {Object[]} requests -  Incoming raw algorithm requests from etcd.
 * @param {Object} algorithmTemplates - Algorithm definitions from DB.
 *   Each template may have a `stateType` property indicating the request type.
 * @returns {Object[]} Array of normalized requests containing `algorithmName` and `requestType` (lowercased or 'batch' if missing).
 */
const normalizeRequests = (algorithmRequests, algorithmTemplates) => {
    if (algorithmRequests == null || algorithmRequests.length === 0 || algorithmRequests[0].data == null) {
        return [];
    }
    
    const normalizedRequests = algorithmRequests[0].data.reduce((acc, request) => {
        const algorithmName = request.name;
        const template = algorithmTemplates[algorithmName];
        if (!template) return acc;
        const requestType = template.stateType ? template.stateType.toLowerCase() : 'batch';

        acc.push({
            algorithmName,
            requestType
        });
        return acc;
    }, []);

    return normalizedRequests;
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

/**
 * Normalizes raw Kubernetes job objects into a simplified structure.
 *
 * @param {Object} jobs - Raw Kubernetes jobs object.
 * @param {Object[]} pods - Kubernetes pod objects.
 * @param {Function} filterFn - Function to filter which jobs to keep.
 * @returns {Object[]} Normalized jobs array.
 */
const normalizeJobs = (jobs, pods, filterFn = () => true) => {
    const jobItems = jobs?.body?.items || [];
    const podsList = objectPath.get(pods, 'body.items', []);
    return jobItems
        .filter(filterFn)
        .map(job => {
            const pod = podsList.find(p => objectPath.get(p, 'metadata.labels.controller-uid', '') === objectPath.get(job, 'metadata.uid'));
            return {
                name: job.metadata.name,
                algorithmName: job.metadata.labels['algorithm-name'],
                active: job.status.active === 1,
                startTime: _tryParseTime(job.status.startTime),
                podName: pod?.metadata?.name,
                nodeName: pod?.spec?.nodeName
            };
        });
    // const jobs = jobsRaw.body.items
    //     .filter(predicate)
    //     .map((j) => {
    //         const pod = podsList.find(p => objectPath.get(p, 'metadata.labels.controller-uid', '') === objectPath.get(j, 'metadata.uid'));
    //         return {
    //             name: j.metadata.name,
    //             algorithmName: j.metadata.labels['algorithm-name'],
    //             active: j.status.active === 1,
    //             startTime: _tryParseTime(j.status.startTime),
    //             podName: objectPath.get(pod, 'metadata.name'),
    //             nodeName: objectPath.get(pod, 'spec.nodeName'),

    //         };
    //     });
    // return jobs;
};

/**
 * Attaches matching jobs to each worker and identifies jobs with no assigned worker.
 *
 * Matching logic:
 * - A job is matched to a worker if the worker's podName starts with the job's name.
 * - Each matched worker gets a `job` property (undefined if no match).
 * - Jobs that are not matched to any worker are returned as `unassignedJobs`.
 *
 * @param {Object[]} workers - Array of normalized worker objects.
 * @param {Object[]} jobs - Array of normalized job objects.
 * @returns {Object} Object containing:
 *   - jobAttachedWorkers: workers with their matched job (or undefined).
 *   - unassignedJobs: jobs with no worker assigned.
 */
const mergeWorkers = (workers, jobs) => {
    const matchedJobNames = new Set();

    const jobAttachedWorkers = workers.map((worker) => {
        const matchedJob = jobs.find(job => worker.podName && worker.podName.startsWith(job.name));
        if (matchedJob) {
            matchedJobNames.add(matchedJob.name);
        }
        return { ...worker, job: matchedJob ? { ...matchedJob } : undefined };
    });

    const extraJobs = jobs.filter(job => !matchedJobNames.has(job.name));

    return { jobAttachedWorkers, extraJobs };
};

module.exports = {
    normalizeWorkers,
    normalizeWorkerImages,
    normalizeHotRequestsByType,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeRequests,
    normalizeJobs,
    mergeWorkers,
    normalizeResources,
};
