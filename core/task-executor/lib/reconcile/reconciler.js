const Logger = require('@hkube/logger');
const { warningCodes } = require('@hkube/consts');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const { createWarning } = require('../utils/warningCreator');
const { createJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { commands, components, consts } = require('../consts');
const component = components.RECONCILER;

const { normalizeWorkers,
    normalizeWorkerImages,
    normalizeHotRequests,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeRequests,
    normalizeJobs,
    mergeWorkers } = require('./normalize');

const { setWorkerImage, createContainerResource, setAlgorithmImage } = require('./createOptions');
const { matchJobsToResources, pauseAccordingToResources, parseResources } = require('./resources');
const { CPU_RATIO_PRESSURE, MEMORY_RATIO_PRESSURE } = consts;

let createdJobsList = [];

let totalCapacityNow = 10; // how much pods are running now
const WINDOW_SIZE_FACTOR = 3;
const unscheduledAlgorithms = {};
const ignoredunscheduledAlgorithms = {};

const _updateCapacity = (algorithmCount) => {
    const factor = 0.9;
    const minCapacity = 2;
    const maxCapacity = 50;
    totalCapacityNow = totalCapacityNow * factor + algorithmCount * (1 - factor);
    if (totalCapacityNow < minCapacity) {
        totalCapacityNow = minCapacity;
    }
    if (totalCapacityNow > maxCapacity) {
        totalCapacityNow = maxCapacity;
    }
};

const _createJob = (jobDetails, options) => {
    const spec = createJobSpec({ ...jobDetails, options });
    const jobCreateResult = kubernetes.createJob({ spec, jobDetails });
    return jobCreateResult;
};

const _idleWorkerFilter = (worker, algorithmName) => {
    let match = worker.workerStatus === 'ready' && !worker.workerPaused;
    if (algorithmName) {
        match = match && worker.algorithmName === algorithmName;
    }
    return match;
};

const _activeWorkerFilter = (worker, algorithmName) => {
    let match = worker.workerStatus !== 'ready' && !worker.workerPaused;
    if (algorithmName) {
        match = match && worker.algorithmName === algorithmName;
    }
    return match;
};

const _pausedWorkerFilter = (worker, algorithmName) => {
    let match = worker.workerStatus === 'ready' && worker.workerPaused;
    if (algorithmName) {
        match = match && worker.algorithmName === algorithmName;
    }
    return match;
};

const _stopWorker = (worker) => {
    return etcd.sendCommandToWorker({
        workerId: worker.id, command: commands.stopProcessing, algorithmName: worker.algorithmName, podName: worker.podName
    });
};
const _resumeWorker = (worker) => {
    return etcd.sendCommandToWorker({
        workerId: worker.id, command: commands.startProcessing, algorithmName: worker.algorithmName, podName: worker.podName
    });
};
const _coolDownWorker = (worker) => {
    return etcd.sendCommandToWorker({
        workerId: worker.id, command: commands.coolDown, algorithmName: worker.algorithmName, podName: worker.podName
    });
};

const _warmUpWorker = (worker) => {
    return etcd.sendCommandToWorker({
        workerId: worker.id, command: commands.warmUp, algorithmName: worker.algorithmName, podName: worker.podName
    });
};

const _exitWorker = (worker) => {
    return etcd.sendCommandToWorker({
        workerId: worker.id, command: commands.exit, message: worker.message, algorithmName: worker.algorithmName, podName: worker.podName
    });
};

const _clearCreatedJobsList = (now, options) => {
    const newCreatedJobsList = createdJobsList.filter(j => (now || Date.now()) - j.createdTime < options.createdJobsTTL);
    const items = createdJobsList.length - newCreatedJobsList.length;
    if (items > 0) {
        log.trace(`removed ${items} items from jobCreated list`, { component });
    }
    createdJobsList = newCreatedJobsList;
};

const _processAllRequests = (
    { idleWorkers, pausedWorkers, pendingWorkers, algorithmTemplates, versions, jobsCreated, normRequests, registry, clusterOptions, workerResources },
    { createDetails, reconcileResult, toResume, scheduledRequests }
) => {
    for (let r of normRequests) {// eslint-disable-line
        const { algorithmName, hotWorker } = r;

        // Check for idle workers
        const idleWorkerIndex = idleWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (idleWorkerIndex !== -1) {
            // there is idle worker. don't do anything
            const [worker] = idleWorkers.splice(idleWorkerIndex, 1);
            scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
            continue;
        }

        // Check for pending workers
        const pendingWorkerIndex = pendingWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (pendingWorkerIndex !== -1) {
            // there is a pending worker.
            const [worker] = pendingWorkers.splice(pendingWorkerIndex, 1);
            scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
            continue;
        }

        // Check for recently creates jobs
        const jobsCreatedIndex = jobsCreated.findIndex(w => w.algorithmName === algorithmName);
        if (jobsCreatedIndex !== -1) {
            // there is a pending worker.
            const [worker] = jobsCreated.splice(jobsCreatedIndex, 1);
            scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
            continue;
        }

        // Check for paused workers
        const pausedWorkerIndex = pausedWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (pausedWorkerIndex !== -1) {
            // there is paused worker. wake it up
            toResume.push({ ...(pausedWorkers[pausedWorkerIndex]) });
            const [worker] = pausedWorkers.splice(pausedWorkerIndex, 1);
            scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
            continue;
        }

        // Build request to create new worker job (if no suitable workers found)
        const algorithmTemplate = algorithmTemplates[algorithmName];
        const { workerCustomResources } = algorithmTemplates[algorithmName];
        const algorithmImage = setAlgorithmImage(algorithmTemplate, versions, registry);
        const workerImage = setWorkerImage(algorithmTemplate, versions, registry);
        const resourceRequests = createContainerResource(algorithmTemplate);
        const workerResourceRequests = createContainerResource(workerResources);

        const { kind, workerEnv, algorithmEnv, labels, annotations, version: algorithmVersion, nodeSelector,
            entryPoint, options: algorithmOptions, reservedMemory, mounts, env, sideCars, volumes, volumeMounts } = algorithmTemplate;

        // Add request details for new job creation (will need to get confirmation via matchJobsToResources)
        createDetails.push({
            numberOfNewJobs: 1,
            jobDetails: {
                kind,
                env,
                algorithmName,
                algorithmImage,
                algorithmVersion,
                workerImage,
                workerEnv,
                algorithmEnv,
                labels,
                annotations,
                nodeSelector,
                entryPoint,
                hotWorker,
                resourceRequests,
                workerResourceRequests,
                clusterOptions,
                algorithmOptions,
                mounts,
                reservedMemory,
                sideCars,
                workerCustomResources,
                volumes,
                volumeMounts
            }
        });

        if (!reconcileResult[algorithmName]) {
            reconcileResult[algorithmName] = {
                required: 1,
                idle: 0,
                paused: 0
            };
        }
        else {
            reconcileResult[algorithmName].required += 1;
        }
    }
};

const _createStopDetails = ({ worker, algorithmTemplates }) => {
    const algorithmTemplate = algorithmTemplates[worker.algorithmName];
    const resourceRequests = createContainerResource(algorithmTemplate);
    return {
        count: 1,
        details: {
            algorithmName: worker.algorithmName,
            resourceRequests,
            nodeName: worker.job ? worker.job.nodeName : null,
            podName: worker.podName,
            id: worker.id
        }
    };
};

const _findWorkersToStop = ({ skipped, idleWorkers, activeWorkers, algorithmTemplates }, { stopDetails }) => {
    const missingCount = skipped.length;
    if (missingCount === 0) {
        return;
    }

    // find stats about required workers
    // log.info(`totalCapacityNow=${totalCapacityNow}, missingCount=${missingCount}`);

    const skippedTypes = Object.entries(skipped.reduce((prev, cur, index) => {
        if (!prev[cur.algorithmName]) {
            prev[cur.algorithmName] = {
                count: 0,
                list: []
            };
        }
        prev[cur.algorithmName].count += ((skipped.length - index) ** 0.7);
        prev[cur.algorithmName].list.push(cur);
        return prev;
    }, {})).map(([k, v]) => ({ algorithmName: k, count: v.count, list: v.list }));

    // log.info(JSON.stringify(skippedTypes.map(s => ({ name: s.algorithmName, count: s.count })), null, 2));

    const skippedLocal = clonedeep(skipped);
    const idleWorkersLocal = clonedeep(idleWorkers);
    let activeWorkersLocal = clonedeep(activeWorkers);
    const notUsedWorkers = activeWorkersLocal.filter(w => !skippedTypes.find(d => d.algorithmName === w.algorithmName));
    const usedWorkers = activeWorkersLocal.filter(w => skippedTypes.find(d => d.algorithmName === w.algorithmName));

    skippedLocal.forEach((s) => {
        let skippedResources = parseResources(s);
        const needMoreResources = ({ requestedCpu, memoryRequests, requestedGpu }) => {
            return requestedCpu > 0 || memoryRequests > 0 || requestedGpu > 0;
        };

        const _subtractResources = (resources, { requestedCpu, memoryRequests, requestedGpu }) => {
            const newResources = {
                requestedCpu: resources.requestedCpu - requestedCpu,
                memoryRequests: resources.memoryRequests - memoryRequests,
                requestedGpu: resources.requestedGpu - requestedGpu
            };
            return newResources;
        };

        while ((idleWorkersLocal.length > 0 || notUsedWorkers.length > 0 || usedWorkers.length > 0) && needMoreResources(skippedResources)) {
            let worker = idleWorkersLocal.shift();
            if (!worker) {
                worker = notUsedWorkers.shift();
            }
            if (!worker) {
                worker = usedWorkers.shift();
            }
            if (worker) {
                activeWorkersLocal = activeWorkersLocal.filter(w => w.id !== worker.id);
                const toStop = _createStopDetails({ worker, algorithmTemplates });
                skippedResources = _subtractResources(skippedResources, parseResources(toStop.details));
                stopDetails.push(toStop);
            }
        }
    });
};

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

const calcRatio = (totalRequests, capacity) => {
    const requestTypes = totalRequests.reduce((prev, cur) => {
        if (!prev.algorithms[cur.algorithmName]) {
            prev.algorithms[cur.algorithmName] = {
                count: 0,
                list: []
            };
        }
        prev.algorithms[cur.algorithmName].count += 1;
        prev.algorithms[cur.algorithmName].list.push(cur);
        prev.total += 1;
        return prev;
    }, { total: 0, algorithms: {} });
    Object.keys(requestTypes.algorithms).forEach(k => {
        if (capacity) {
            const ratio = requestTypes.algorithms[k].count / requestTypes.total;
            const required = ratio * capacity;
            requestTypes.algorithms[k].ratio = ratio;
            requestTypes.algorithms[k].required = required;
        }
    });
    return requestTypes;
};

/**
 * This method check for algorithms that cannot be scheduled.
 * We are using an algorithms map of <algorithm-name> --> <warning>.
 * The logic is as follows:
 * 1) iterate over the skipped algorithms and update the map.
 * 2) iterate over the algorithms map and check if we have a
 *    created, requested or deletion of an algorithm.
 * 3) if we found such an algorithm, we delete it from map.
 * 4) each iteration we update the discovery with the current map.
 */
const _checkUnscheduled = (created, skipped, requests, algorithms, algorithmsForLogging, algorithmTemplates) => {
    skipped.forEach((s) => {
        if (!algorithms[s.algorithmName]) {
            algorithms[s.algorithmName] = s.warning;
        }
    });

    const algorithmsMap = Object.keys(algorithms);
    if (algorithmsMap.length > 0) {
        const createdSet = new Set(created.map(x => x.algorithmName));
        const requestSet = new Set(requests.map(x => x.algorithmName));
        algorithmsMap.forEach((k) => {
            const create = createdSet.has(k);
            const request = requestSet.has(k);
            // If algo was created, or not requested, or template missing, remove it from map and log it to etcd.
            if (create || !request || !algorithmTemplates[k]) {
                algorithmsForLogging = {
                    ...algorithmsForLogging,
                    [k]: algorithms[k]
                };
                delete algorithms[k];
            }
        });
    }
    algorithmsForLogging = algorithmsForLogging || {}; // Persistant type for etcd.
    return { unScheduledAlgorithms: algorithms, ignoredUnScheduledAlgorithms: algorithmsForLogging };
};

const _workersToMap = (requests) => {
    return requests.reduce((prev, cur) => {
        if (!prev[cur.algorithmName]) {
            prev[cur.algorithmName] = 0;
        }
        prev[cur.algorithmName] += 1;
        return prev;
    }, {});
};

const _mergeRequisiteRequests = (requests, requisites) => {
    /**
    *
    * requisites:
    *     alg  | count | req  | diff
    *   green  |  800  |  80  |  10
    *   yellow |  200  |  20  |  8
    *   black  |  100  |  10  |  5
    *   total  |  1100 |  110 |  23
    * 
    * ratios:
    *   green:  (10 / 23) * 10 = ~4
    *   yellow: (08 / 23) * 8  = ~3
    *   black:  (05 / 23) * 5  = ~1
    *   [g,g,g,g,y,y,y,b]
    *
    */

    const ratioSum = requisites.totalRequired;

    while (requisites.totalRequired > 0) {
        Object.values(requisites.algorithms).forEach((v) => {
            const ratio = (v.required.length / ratioSum);
            const required = Math.round(v.required.length * ratio) || 1;
            const diff = requisites.totalRequired - required;
            const total = diff < 0 ? requisites.totalRequired : required;
            const arr = v.required.slice(0, total);
            requisites.totalRequired -= arr.length;
            requests.unshift(...arr);
        });
    }
    return requests;
};

const _createRequisitesRequests = (normRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers) => {
    const requests = [];
    const visited = {};
    const indices = {};
    const requisites = { algorithms: {}, totalRequired: 0 };
    const runningWorkersList = [...idleWorkers, ...activeWorkers, ...pausedWorkers, ...pendingWorkers];
    const runningWorkersMap = _workersToMap(runningWorkersList);

    normRequests.forEach((r, i) => {
        const { algorithmName } = r;
        const quotaGuarantee = algorithmTemplates[algorithmName]?.quotaGuarantee;
        if (quotaGuarantee && !visited[algorithmName]) {
            visited[algorithmName] = true;
            const running = runningWorkersMap[algorithmName] || 0;
            const diff = quotaGuarantee - running;
            if (diff > 0) {
                const required = normRequests
                    .map((a, j) => ({ index: j, alg: a }))
                    .filter(n => n.alg.algorithmName === algorithmName)
                    .slice(0, diff);
                requisites.algorithms[algorithmName] = requisites.algorithms[algorithmName] || {};
                requisites.algorithms[algorithmName].required = required.map(a => a.alg);
                requisites.totalRequired += required.length;
                required.forEach((alg) => {
                    indices[alg.index] = true; // save the indices so we will ignore them next iteration.
                });
            }
            else {
                requests.push(r);
            }
        }
        else if (!indices[i]) {
            requests.push(r);
        }
    });
    return { requests, requisites };
};

const _createRequisite = (normRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers) => {
    const hasRequisiteAlgorithms = normRequests.some(r => algorithmTemplates[r.algorithmName]?.quotaGuarantee);
    let currentRequests = normRequests;

    if (hasRequisiteAlgorithms) {
        const { requests, requisites } = _createRequisitesRequests(normRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers);
        currentRequests = _mergeRequisiteRequests(requests, requisites);
    }
    return currentRequests;
};

const _createWindow = (currentRequests) => {
    const windowSize = Math.round(totalCapacityNow * WINDOW_SIZE_FACTOR);
    return currentRequests.slice(0, windowSize);
};

/**
 * This method does two things: 
 *    1. prioritizing algorithms that have `quotaGuarantee`.
 *    2. creating a subset (window) from the requests.
 * The algorithm is as follows:
 *    1. If there is any algorithm with `quotaGuarantee`.
 *      a. Iterate all requests.
 *      b. If encountered an algorithm with `quotaGuarantee` that didn't handle.
 *         b1. Mark the algorithm as visited.
 *         b2. Calculate missing algorithms by `quotaGuarantee - running`.
 *         b3. If there are a missing algorithms, move these algorithms to the top of our window.
 *         b4. Save the indices of these algorithms to ignore them next iteration.
 *         b5. If there are no missing algorithms, just add it to the window.
 *      c. If already moved this algorithm to the top, ignore it, else add it to the window.
 *    2. creating new window from the requests
 */
const _createRequestsWindow = (algorithmTemplates, normRequests, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers) => {
    // Get list of requests that are quotaGuaranteed, meaning should be handled first.
    const currentRequests = _createRequisite(normRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers);
    const requestsWindow = _createWindow(currentRequests);
    return requestsWindow;
};

const _handleMaxWorkers = (algorithmTemplates, normRequests, workers) => {
    const workersPerAlgorithm = workers.reduce((prev, cur) => {
        const { algorithmName } = cur;
        prev[algorithmName] = prev[algorithmName] ? prev[algorithmName] + 1 : 1;
        return prev;
    }, {});
    const filtered = normRequests.filter(r => {
        const maxWorkers = algorithmTemplates[r.algorithmName]?.maxWorkers;
        if (!maxWorkers) {
            return true;
        }
        if ((workersPerAlgorithm[r.algorithmName] || 0) < maxWorkers) {
            workersPerAlgorithm[r.algorithmName] = workersPerAlgorithm[r.algorithmName] ? workersPerAlgorithm[r.algorithmName] + 1 : 1;
            return true;
        }
        return false;
    });
    return filtered;
};

/**
 * Fetches the names of all PersistentVolumeClaims (PVCs), ConfigMaps, and Secrets in the Kubernetes cluster.
 *
 * @async
 * @function _getAllVolumes
 * @returns {Promise<Object>} A promise that resolves to an object containing arrays of names for PVCs, ConfigMaps, and Secrets.
 *
 * @property {string[]} pvcs - An array of PersistentVolumeClaim names.
 * @property {string[]} configMaps - An array of ConfigMap names.
 * @property {string[]} secrets - An array of Secret names.
 *
 * @throws {Error} Throws an error if there is an issue while fetching the resources.
 */
const _getAllVolumeNames = async () => {
    const pvcs = await kubernetes.getAllPVCNames();
    const configMaps = await kubernetes.getAllConfigMapNames();
    const secrets = await kubernetes.getAllSecretNames();
    
    const volumesNames = { pvcs, configMaps, secrets };
    return volumesNames;
};

const _checkResourcePressure = (normResources) => {
    const isCpuPressure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESSURE;
    const isMemoryPressure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESSURE;
    const isResourcePressure = isCpuPressure || isMemoryPressure;
    if (isResourcePressure) {
        log.trace(`isCpuPressure: ${isCpuPressure}, isMemoryPressure: ${isMemoryPressure}`, { component });
    }
};

// Utility function to categorize workers
const _categorizeWorkers = (mergedWorkers, merged) => {
    // Identify worker types
    const idleWorkers = clonedeep(mergedWorkers.filter(w => _idleWorkerFilter(w)));
    const activeWorkers = clonedeep(mergedWorkers.filter(w => _activeWorkerFilter(w)));
    const pausedWorkers = clonedeep(mergedWorkers.filter(w => _pausedWorkerFilter(w)));
    // workers that already have a job created but no worker registered yet:
    const pendingWorkers = clonedeep(merged.extraJobs);
    const jobsCreated = clonedeep(createdJobsList);
    
    return {
        idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, jobsCreated
    };
};

// cut requests based on ratio, since totalCapacityNow should grow gradually, we cut some of the requests, we do it according to their ratio of all requests.
const _cutRequests = (totalRequests, requestTypes) => {
    const cutRequests = [];
    totalRequests.forEach(r => {
        const ratios = calcRatio(cutRequests, totalCapacityNow);
        const { required } = requestTypes.algorithms[r.algorithmName];
        const algorithm = ratios.algorithms[r.algorithmName];
        if (!algorithm || algorithm.count < required) {
            cutRequests.push(r);
        }
    });
    return cutRequests;
};

const _filterWorkersToStop = (toStop, toResume) => {
    const toStopFiltered = [];
    toStop.forEach(worker => {
        const index = toResume.findIndex(resumed => resumed.algorithmName === worker.algorithmName);
        if (index !== -1) {
            toResume.splice(index, 1);
        }
        else {
            toStopFiltered.push(worker);
        }
    });
    return toStopFiltered;
};

// Function to process promises for worker actions (stopping, warming, cooling, etc.)
const _processPromises = async ({ exitWorkers, warmUpWorkers, coolDownWorkers, toStopFiltered, toResume, skipped, requested, options }) => {
    const exitWorkersPromises = exitWorkers.map(r => _exitWorker(r));
    const warmUpPromises = warmUpWorkers.map(r => _warmUpWorker(r));
    const coolDownPromises = coolDownWorkers.map(r => _coolDownWorker(r));
    const stopPromises = toStopFiltered.map(r => _stopWorker(r));
    const resumePromises = toResume.map(r => _resumeWorker(r));
    const createPromises = [];
    requested.forEach(jobDetails => createPromises.push(_createJob(jobDetails, options)));

    const resolvedPromises = await Promise.all([...createPromises, ...stopPromises, ...exitWorkersPromises, ...warmUpPromises, ...coolDownPromises, ...resumePromises]);
    const created = [];
    createPromises.forEach((_, index) => {
        const response = resolvedPromises[index];
    
        if (response && response.statusCode === 422) {
            const { jobDetails, message, spec } = response;
            const warning = createWarning({ jobDetails, code: warningCodes.JOB_CREATION_FAILED, message, spec });
    
            skipped.push({
                ...jobDetails,
                warning
            });
        }
        else if (response.statusCode === 200 || response.statusCode === 201) {
            created.push(response.jobDetails);
        }
    });
    return created;
};

const _updateReconcileResult = async ({ reconcileResult, unScheduledAlgorithms, ignoredUnScheduledAlgorithms, created, skipped, toStop, toResume, workerStats, normResources }) => {
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
                resumed workers: ${resumed}, required: ${required}.`);
        }
        reconcileResult[algorithmName].active = ws.count;
    });
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, workers, jobs, pods, versions, normResources, registry, options, clusterOptions, workerResources } = {}) => {
    // Update the cache of jobs lately created by removing old jobs
    _clearCreatedJobsList(null, options);

    const normWorkers = normalizeWorkers(workers);
    const normJobs = normalizeJobs(jobs, pods, j => (!j.status.succeeded && !j.status.failed));

    // assign created jobs to workers, and list all jobs with no workers.
    const merged = mergeWorkers(normWorkers, normJobs);
    // filter out algorithm requests that have no such algorithm definition
    const normRequests = normalizeRequests(algorithmRequests, algorithmTemplates);

    // find workers who's image changed
    const exitWorkers = normalizeWorkerImages(normWorkers, algorithmTemplates, versions, registry);
    // subtract the workers which changed from the workers list.
    const mergedWorkers = merged.mergedWorkers.filter(w => !exitWorkers.find(e => e.id === w.id));

    // get a list of workers that should turn 'hot' and be marked as hot.
    const warmUpWorkers = normalizeHotWorkers(mergedWorkers, algorithmTemplates);
    // get a list of workers that should turn 'cold' and not be marked as hot any longer
    const coolDownWorkers = normalizeColdWorkers(mergedWorkers, algorithmTemplates);

    _checkResourcePressure(normResources);

    // Initialize result variables
    const createDetails = [];
    const reconcileResult = {};
    const toResume = [];
    const scheduledRequests = [];

    // Categorize workers into idle, active, paused, etc.
    const { idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, jobsCreated } = _categorizeWorkers(mergedWorkers, merged);

    _updateCapacity(idleWorkers.length + activeWorkers.length + jobsCreated.length);

    // leave only requests that are not exceeding max workers.
    const maxFilteredRequests = _handleMaxWorkers(algorithmTemplates, normRequests, mergedWorkers);
    // In order to handle request gradually create a sub list (according to prioritization.)
    const requestsWindow = _createRequestsWindow(algorithmTemplates, maxFilteredRequests, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers);
    // Add requests for hot workers as well
    const totalRequests = normalizeHotRequests(requestsWindow, algorithmTemplates);
    // log.info(`capacity = ${totalCapacityNow}, totalRequests = ${totalRequests.length} `);
    const requestTypes = calcRatio(totalRequests, totalCapacityNow);
    // const workerTypes = calcRatio(mergedWorkers);
    // log.info(`worker = ${JSON.stringify(Object.entries(workerTypes.algorithms).map(([k, v]) => ({ name: k, ratio: v.ratio })), null, 2)}`);
    // log.info(`requests = ${JSON.stringify(Object.entries(requestTypes.algorithms).map(([k, v]) => ({ name: k, count: v.count, req: v.required })), null, 2)}`);'
    const cutRequests = _cutRequests(totalRequests, requestTypes);

    // const cutRequestTypes = calcRatio(cutRequests, totalCapacityNow);
    // log.info(`cut-requests = ${JSON.stringify(Object.entries(cutRequestTypes.algorithms).map(([k, v]) =>
    //     ({ name: k, count: v.count, req: v.required })).sort((a, b) => a.name - b.name), null, 2)}`);

    _processAllRequests({
        idleWorkers, pausedWorkers, pendingWorkers, algorithmTemplates, versions, jobsCreated, normRequests: cutRequests, registry, clusterOptions, workerResources
    }, { createDetails, reconcileResult, toResume, scheduledRequests });

    // Handle job creation and scheduling
    const allVolumesNames = await _getAllVolumeNames();
    const { requested, skipped } = matchJobsToResources(createDetails, normResources, scheduledRequests, allVolumesNames);

    // if couldn't create all, try to stop some workers
    const stopDetails = [];
    _findWorkersToStop({
        skipped, idleWorkers, activeWorkers, algorithmTemplates, scheduledRequests
    }, { stopDetails });

    const { toStop } = pauseAccordingToResources(stopDetails, normResources, skipped);

    if (requested.length > 0) {
        log.trace(`trying to create ${requested.length} algorithms....`, { component });
    }

    // log.info(`to stop: ${JSON.stringify(toStop.map(s => ({ n: s.algorithmName, id: s.id })))}, toResume: ${JSON.stringify(toResume.map(s => ({ n: s.algorithmName, id: s.id })))} `);
    const toStopFiltered = _filterWorkersToStop(toStop, toResume);

    // log.info(`to stop: ${JSON.stringify(toStopFiltered.map(s => ({ n: s.algorithmName, id: s.id })))}, toResume: ${JSON.stringify(toResume.map(s => ({ n: s.algorithmName, id: s.id })))} `);

    const created = await _processPromises({ 
        exitWorkers, warmUpWorkers, coolDownWorkers, toStopFiltered, toResume, skipped, requested, options 
    });
    created.forEach(j => createdJobsList.push(j));

    const unScheduledObject = _checkUnscheduled(created, skipped, maxFilteredRequests, unscheduledAlgorithms, ignoredunscheduledAlgorithms, algorithmTemplates);
    const { unScheduledAlgorithms, ignoredUnScheduledAlgorithms } = unScheduledObject;

    // add created and skipped info
    const workerStats = _calcStats(normWorkers);
    await _updateReconcileResult({
        reconcileResult, unScheduledAlgorithms, ignoredUnScheduledAlgorithms, created, skipped, toStop, toResume, workerStats, normResources
    });

    return reconcileResult;
};

module.exports = {
    reconcile,
    _clearCreatedJobsList,
    _updateCapacity
};
