const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const parse = require('@hkube/units-converter');
const { createJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { commands, components, consts, gpuVendors } = require('../consts');
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
const MIN_AGE_FOR_STOP = 10 * 1000;
let totalCapacityNow = 10; // how much pods are running now
const WINDOW_SIZE_FACTOR = 3;
const unscheduledAlgorithms = {};

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
        const idleWorkerIndex = idleWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (idleWorkerIndex !== -1) {
            // there is idle worker. don't do anything
            const [worker] = idleWorkers.splice(idleWorkerIndex, 1);
            scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
            continue;
        }

        const pendingWorkerIndex = pendingWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (pendingWorkerIndex !== -1) {
            // there is a pending worker.
            const [worker] = pendingWorkers.splice(pendingWorkerIndex, 1);
            scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
            continue;
        }
        const jobsCreatedIndex = jobsCreated.findIndex(w => w.algorithmName === algorithmName);
        if (jobsCreatedIndex !== -1) {
            // there is a pending worker.
            const [worker] = jobsCreated.splice(jobsCreatedIndex, 1);
            scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
            continue;
        }
        const pausedWorkerIndex = pausedWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (pausedWorkerIndex !== -1) {
            // there is paused worker. wake it up
            toResume.push({ ...(pausedWorkers[pausedWorkerIndex]) });
            const [worker] = pausedWorkers.splice(pausedWorkerIndex, 1);
            scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
            continue;
        }
        const algorithmTemplate = algorithmTemplates[algorithmName];
        const algorithmImage = setAlgorithmImage(algorithmTemplate, versions, registry);
        const workerImage = setWorkerImage(algorithmTemplate, versions, registry);
        const resourceRequests = createContainerResource(algorithmTemplate);
        const workerResourceRequests = createContainerResource(workerResources);

        const { workerEnv, algorithmEnv, version: algorithmVersion, nodeSelector, entryPoint, options: algorithmOptions, reservedMemory, mounts, env } = algorithmTemplate;

        createDetails.push({
            numberOfNewJobs: 1,
            jobDetails: {
                env,
                algorithmName,
                algorithmImage,
                algorithmVersion,
                workerImage,
                workerEnv,
                algorithmEnv,
                nodeSelector,
                entryPoint,
                hotWorker,
                resourceRequests,
                workerResourceRequests,
                clusterOptions,
                algorithmOptions,
                mounts,
                reservedMemory
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
    if (algorithmTemplate && algorithmTemplate.options && algorithmTemplate.options.debug) {
        return null;
    }
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
                if (toStop) {
                    skippedResources = _subtractResources(skippedResources, parseResources(toStop.details));
                    stopDetails.push(toStop);
                }
            }
        }
    });
};

const _calcStats = (data) => {
    const stats = Object.values(data.reduce((acc, cur) => {
        if (!acc[cur.algorithmName]) {
            acc[cur.algorithmName] = {
                algorithmName: cur.algorithmName,
            };
        }
        acc[cur.algorithmName].count = (acc[cur.algorithmName].count || 0) + 1;

        acc[cur.algorithmName][cur.workerStatus] = (acc[cur.algorithmName][cur.workerStatus] || 0) + 1;
        if (cur.hotWorker) {
            acc[cur.algorithmName].hot = (acc[cur.algorithmName].hot || 0) + 1;
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
const _checkUnscheduled = (created, skipped, requests, algorithms, algorithmTemplates) => {
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
            if (create || !request || !algorithmTemplates[k]) {
                delete algorithms[k];
            }
        });
    }
    return algorithms;
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
    const currentRequests = _createRequisite(normRequests, algorithmTemplates, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers);
    const requestsWindow = _createWindow(currentRequests);
    return requestsWindow;
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, workers, jobs, pods, versions, normResources, registry, options, clusterOptions, workerResources } = {}) => {
    _clearCreatedJobsList(null, options);
    const normWorkers = normalizeWorkers(workers);
    const normJobs = normalizeJobs(jobs, pods, j => (!j.status.succeeded && !j.status.failed));
    const merged = mergeWorkers(normWorkers, normJobs);
    const normRequests = normalizeRequests(algorithmRequests);
    const exitWorkers = normalizeWorkerImages(normWorkers, algorithmTemplates, versions, registry);
    const mergedWorkers = merged.mergedWorkers.filter(w => !exitWorkers.find(e => e.id === w.id));
    const warmUpWorkers = normalizeHotWorkers(mergedWorkers, algorithmTemplates);
    const coolDownWorkers = normalizeColdWorkers(mergedWorkers, algorithmTemplates);

    const isCpuPressure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESSURE;
    const isMemoryPressure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESSURE;
    const isResourcePressure = isCpuPressure || isMemoryPressure;
    if (isResourcePressure) {
        log.trace(`isCpuPressure: ${isCpuPressure}, isMemoryPressure: ${isMemoryPressure}`, { component });
    }
    const createDetails = [];
    const createPromises = [];
    const reconcileResult = {};
    const toResume = [];
    const scheduledRequests = [];
    const idleWorkers = clonedeep(mergedWorkers.filter(w => _idleWorkerFilter(w)));
    const activeWorkers = clonedeep(mergedWorkers.filter(w => _activeWorkerFilter(w)));
    const pausedWorkers = clonedeep(mergedWorkers.filter(w => _pausedWorkerFilter(w)));
    const pendingWorkers = clonedeep(merged.extraJobs);
    const jobsCreated = clonedeep(createdJobsList);

    _updateCapacity(idleWorkers.length + activeWorkers.length + jobsCreated.length);

    const requestsWindow = _createRequestsWindow(algorithmTemplates, normRequests, idleWorkers, activeWorkers, pausedWorkers, pendingWorkers);
    const totalRequests = normalizeHotRequests(requestsWindow, algorithmTemplates);

    // log.info(`capacity = ${totalCapacityNow}, totalRequests = ${totalRequests.length} `);
    const requestTypes = calcRatio(totalRequests, totalCapacityNow);
    // const workerTypes = calcRatio(mergedWorkers);
    // log.info(`worker = ${JSON.stringify(Object.entries(workerTypes.algorithms).map(([k, v]) => ({ name: k, ratio: v.ratio })), null, 2)}`);
    // log.info(`requests = ${JSON.stringify(Object.entries(requestTypes.algorithms).map(([k, v]) => ({ name: k, count: v.count, req: v.required })), null, 2)}`);
    // cut requests based on ratio
    const cutRequests = [];
    totalRequests.forEach(r => {
        const ratios = calcRatio(cutRequests, totalCapacityNow);
        const { required } = requestTypes.algorithms[r.algorithmName];
        const algorithm = ratios.algorithms[r.algorithmName];
        if (!algorithm || algorithm.count < required) {
            cutRequests.push(r);
        }
    });
    // const cutRequestTypes = calcRatio(cutRequests, totalCapacityNow);
    // log.info(`cut-requests = ${JSON.stringify(Object.entries(cutRequestTypes.algorithms).map(([k, v]) =>
    //     ({ name: k, count: v.count, req: v.required })).sort((a, b) => a.name - b.name), null, 2)}`);

    _processAllRequests(
        {
            idleWorkers, pausedWorkers, pendingWorkers, normResources, algorithmTemplates, versions, jobsCreated, normRequests: cutRequests, registry, clusterOptions, workerResources
        },
        {
            createDetails, reconcileResult, toResume, scheduledRequests
        }
    );
    const { created, skipped } = matchJobsToResources(createDetails, normResources, scheduledRequests);
    created.forEach((j) => {
        createdJobsList.push(j);
    });

    const unScheduledAlgorithms = _checkUnscheduled(created, skipped, normRequests, unscheduledAlgorithms, algorithmTemplates);

    // if couldn't create all, try to stop some workers
    const stopDetails = [];
    const resourcesToFree = skipped.reduce((prev, cur) => {
        return {
            cpu: prev.cpu + cur.resourceRequests.requests.cpu,
            gpu: prev.gpu + cur.resourceRequests.requests[gpuVendors.NVIDIA],
            memory: prev.memory + parse.getMemoryInMi(cur.resourceRequests.requests.memory)
        };
    }, { cpu: 0, gpu: 0, memory: 0 });

    _findWorkersToStop({
        skipped, idleWorkers, activeWorkers, algorithmTemplates, scheduledRequests
    }, { stopDetails });

    const { toStop } = pauseAccordingToResources(
        stopDetails,
        normResources,
        [...idleWorkers.filter(w => (w.job && Date.now() - w.job.startTime > MIN_AGE_FOR_STOP) && !w.hotWorker), ...activeWorkers.filter(w => !w.hotWorker)],
        resourcesToFree,
        skipped
    );
    if (created.length > 0) {
        log.trace(`creating ${created.length} algorithms....`, { component });
    }

    // log.info(`to stop: ${JSON.stringify(toStop.map(s => ({ n: s.algorithmName, id: s.id })))}, toResume: ${JSON.stringify(toResume.map(s => ({ n: s.algorithmName, id: s.id })))} `);
    const toStopFiltered = [];
    toStop.forEach(s => {
        const index = toResume.findIndex(tr => tr.algorithmName === s.algorithmName);
        if (index !== -1) {
            toResume.splice(index, 1);
        }
        else {
            toStopFiltered.push(s);
        }
    });

    // log.info(`to stop: ${JSON.stringify(toStopFiltered.map(s => ({ n: s.algorithmName, id: s.id })))}, toResume: ${JSON.stringify(toResume.map(s => ({ n: s.algorithmName, id: s.id })))} `);

    const exitWorkersPromises = exitWorkers.map(r => _exitWorker(r));
    const warmUpPromises = warmUpWorkers.map(r => _warmUpWorker(r));
    const coolDownPromises = coolDownWorkers.map(r => _coolDownWorker(r));
    const stopPromises = toStopFiltered.map(r => _stopWorker(r));
    const resumePromises = toResume.map(r => _resumeWorker(r));
    createPromises.push(created.map(r => _createJob(r, options)));

    await Promise.all([...createPromises, ...stopPromises, ...exitWorkersPromises, ...warmUpPromises, ...coolDownPromises, ...resumePromises]);
    // add created and skipped info
    const workerStats = _calcStats(normWorkers);

    Object.entries(reconcileResult).forEach(([algorithmName, res]) => {
        res.created = created.filter(c => c.algorithmName === algorithmName).length;
        res.skipped = skipped.filter(c => c.algorithmName === algorithmName).length;
        res.paused = toStop.filter(c => c.algorithmName === algorithmName).length;
        res.resumed = toResume.filter(c => c.algorithmName === algorithmName).length;
    });
    await etcd.updateDiscovery({
        reconcileResult,
        unScheduledAlgorithms,
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
        reconcileResult[algorithmName].active = ws.count;
    });
    return reconcileResult;
};

module.exports = {
    reconcile,
    _clearCreatedJobsList,
    _updateCapacity
};
