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
 * Normalizes algorithm requests by ensuring the minimum number of "hot worker" requests
 * are included for each algorithm type specified.
 * 
 * For each algorithm in the template store that matches the requested types and has a
 * positive `minHotWorkers` value, this function ensures there are at least that many
 * "hot worker" requests (with the `hotWorker: true` flag). If there are more existing requests
 * than the minimum, the excess requests are appended after the hot workers. Requests for
 * algorithms not in the filtered template store are appended unchanged.
 * 
 * @param {Object[]} algorithmRequests - Array of algorithm request objects.
 * @param {Object} algorithmTemplateStore - Algorithm definitions from DB.
 * 
 * @returns {Object[]} An array of requests that includes the required minimum hot worker requests
 *          for each algorithm and retains existing requests beyond the minimum.
 */
const normalizeHotRequests = (algorithmRequests, algorithmTemplateStore) => {
    const algorithmTemplates = algorithmTemplateStore || {};
    const normRequests = algorithmRequests || [];

    // Filter templates by minHotWorkers > 0
    const filteredTemplates = Object.entries(algorithmTemplates).filter(([, alg]) => alg.minHotWorkers > 0);

    if (filteredTemplates.length === 0) {
        return normRequests;
    }

    const requests = [];
    // Group requests by algorithmName for quick lookup
    const groupedRequests = groupBy(normRequests, 'algorithmName');

    const filteredAlgNames = new Set();
    filteredTemplates.forEach(([algName, algTemplate]) => {
        filteredAlgNames.add(algName);
        const requestType = (algTemplate.stateType || 'batch').toLowerCase();
        const minHot = algTemplate.minHotWorkers;
        const existingRequests = groupedRequests[algName] || [];
        const requestsPerAlgorithm = existingRequests.length;

        // Create hot worker requests
        const hotWorkers = new Array(minHot).fill(null).map(() => ({ algorithmName: algName, hotWorker: true, requestType }));

        if (requestsPerAlgorithm > minHot) {
            // Keep hot workers and append the extra existing requests beyond the minimum
            const diff = requestsPerAlgorithm - minHot;
            const excessRequests = existingRequests.slice(0, diff);
            requests.push(...hotWorkers, ...excessRequests);
        }
        else {
            // Just add the hot workers if not enough existing requests
            requests.push(...hotWorkers);
        }
    });

    // Add back any requests whose algorithmName does not appear in filteredTemplates
    requests.push(...normRequests.filter(req => !filteredAlgNames.has(req.algorithmName)));
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

/**
 * Calculates ratio of used resources and remaining free capacity for a node.
 *
 * @param {Object} node - Node object with `total` and `requests` fields.
 */
const _calcRatioFree = (node) => {
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

/**
 * Filters out nodes that are unschedulable due to "NoSchedule" taints.
 *
 * @param {Object} node - Node resource object with spec/taints.
 * @returns {boolean} True if node can accept pods, false otherwise.
 */
const _filterSchedulableNodes = (node) => {
    return !(node.spec && node.spec.taints && node.spec.taints.some(taint => taint.effect === 'NoSchedule'));
};

/**
 * Extracts numeric GPU allocation from a resource object.
 *
 * @param {Object} gpu - GPU resource object (e.g., from node allocatable or container limits).
 * @returns {number} GPU amount, defaults to 0.
 */
const _extractGpuValue = (gpu) => {
    if (!gpu || !gpu[gpuVendors.NVIDIA]) {
        return 0;
    }
    return parseFloat(gpu[gpuVendors.NVIDIA]);
};

/**
 * Extracts GPU requests and limits from a pod definition.
 *
 * @param {Object} pod - Pod object with containers and metadata.
 * @returns {Object} { limitsGpu, requestGpu }
 */
const _extractGpuResources = (pod) => {
    let limitsGpu = sumBy(pod.spec.containers, c => _extractGpuValue(objectPath.get(c, 'resources.limits', 0)));

    if (!limitsGpu) {
        limitsGpu = _extractGpuValue(objectPath.get(pod, 'metadata.annotations', null));
    }
    const requestGpu = limitsGpu;
    return { limitsGpu, requestGpu };
};

/**
 * Extracts CPU, memory, and GPU requests/limits from a pod definition.
 *
 * @param {Object} pod - Pod object with containers and resources.
 * @returns {Object} { requestCpu, requestMem, requestGpu, limitsCpu, limitsMem, limitsGpu }
 */
const _extractPodResources = (pod) => {
    // CPU
    const requestCpu = sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.requests.cpu', '0m')));
    const limitsCpu = sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.limits.cpu', '0m')));

    // Memory
    const requestMem = sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.requests.memory', 0), true));
    const limitsMem = sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.limits.memory', 0), true));

    // GPU
    const { limitsGpu, requestGpu } = _extractGpuResources(pod);

    return {
        requestCpu, requestMem, requestGpu, limitsCpu, limitsMem, limitsGpu
    };
};

/**
 * Builds cluster resource usage view by aggregating pod requests and node capacities.
 *
 * Produces a clear view of:
 * - per-node usage and free resources
 * - overall "allNodes" usage across the cluster
 *
 * @param {Object} resources - Cluster data from Kubernetes.
 * @param {Object} resources.pods - Pod list API response.
 * @param {Object} resources.nodes - Node list API response.
 * @returns {Object} { allNodes, nodeList }
 */
const normalizeResources = ({ pods, nodes } = {}) => {
    if (!pods || !nodes) {
        return {
            allNodes: {
                ratio: { cpu: 0, gpu: 0, memory: 0 },
                free: { cpu: 0, gpu: 0, memory: 0 }
            },
            nodeList: []
        };
    }

    // Build initial node map
    const nodeMap = nodes.body.items.filter(_filterSchedulableNodes).reduce((accumulator, node) => {
        accumulator[node.metadata.name] = {
            labels: node.metadata.labels,
            requests: { cpu: 0, gpu: 0, memory: 0 },
            limits: { cpu: 0, gpu: 0, memory: 0 },
            workersTotal: { cpu: 0, gpu: 0, memory: 0 },
            workers: [],
            other: { cpu: 0, gpu: 0, memory: 0 },
            total: {
                cpu: parse.getCpuInCore(node.status.allocatable.cpu),
                gpu: _extractGpuValue(node.status.allocatable) || 0,
                memory: parse.getMemoryInMi(node.status.allocatable.memory, true)
            }
        };
        return accumulator;
    }, {});

    const allNodes = {
        requests: { cpu: 0, gpu: 0, memory: 0 },
        limits: { cpu: 0, gpu: 0, memory: 0 },
        total: {
            cpu: sumBy(Object.values(nodeMap), 'total.cpu'),
            gpu: sumBy(Object.values(nodeMap), 'total.gpu'),
            memory: sumBy(Object.values(nodeMap), 'total.memory'),
        }
    };

    // Track pod usage per node
    const stateFilter = pod => pod.status.phase === 'Running' || pod.status.phase === 'Pending';
    const resourcesPerNode = pods.body.items.filter(stateFilter).reduce((accumulator, pod) => {
        const { nodeName } = pod.spec;
        if (!nodeName || !accumulator[nodeName]) {
            return accumulator;
        }
        const { requestCpu, requestMem, requestGpu, limitsCpu, limitsMem, limitsGpu } = _extractPodResources(pod);
        const { useResourceLimits } = globalSettings;

        accumulator[nodeName].requests.cpu += (useResourceLimits && limitsCpu) ? Math.max(requestCpu, limitsCpu) : requestCpu;
        accumulator[nodeName].requests.memory += (useResourceLimits && limitsMem) ? Math.max(requestMem, limitsMem) : requestMem;
        accumulator[nodeName].requests.gpu += requestGpu;

        accumulator[nodeName].limits.cpu += limitsCpu;
        accumulator[nodeName].limits.memory += limitsMem;
        accumulator[nodeName].limits.gpu += limitsGpu;

        if (objectPath.get(pod, 'metadata.labels.type') === 'worker') {
            accumulator[nodeName].workersTotal.cpu += requestCpu;
            accumulator[nodeName].workersTotal.gpu += requestGpu;
            accumulator[nodeName].workersTotal.memory += requestMem;
            accumulator[nodeName].workers.push({
                algorithmName: objectPath.get(pod, 'metadata.labels.algorithm-name'),
                podName: objectPath.get(pod, 'metadata.name'),
                nodeName
            });
        }
        else {
            accumulator[nodeName].other.cpu += requestCpu;
            accumulator[nodeName].other.gpu += requestGpu;
            accumulator[nodeName].other.memory += requestMem;
        }

        return accumulator;
    }, nodeMap);

    // Build node list and aggregate totals
    const nodeList = [];
    Object.entries(resourcesPerNode).forEach(([nodeName, nodeData]) => {
        _calcRatioFree(nodeData);

        allNodes.requests.cpu += nodeData.requests.cpu;
        allNodes.requests.memory += nodeData.requests.memory;
        allNodes.requests.gpu += nodeData.requests.gpu;

        allNodes.limits.cpu += nodeData.limits.cpu;
        allNodes.limits.memory += nodeData.limits.memory;
        allNodes.limits.gpu += nodeData.limits.gpu;

        nodeList.push({ name: nodeName, ...nodeData });
    });

    _calcRatioFree(allNodes);
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

/**
 * Tries to parse a given time string into a timestamp (milliseconds since epoch).
 * If the string cannot be parsed, it returns null.
 *
 * @param {string} timeString - The time string to be parsed.
 * @returns {number|null} - The timestamp in milliseconds if successful, or null if invalid.
 */
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
                podName: objectPath.get(pod, 'metadata.name'),
                nodeName: objectPath.get(pod, 'spec.nodeName')
            };
        });
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
const attacheJobToWorker = (workers, jobs) => {
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
    normalizeHotRequests,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeRequests,
    normalizeJobs,
    attacheJobToWorker,
    normalizeResources,
};
