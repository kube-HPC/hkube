const Logger = require('@hkube/logger');
const { warningCodes, stateType } = require('@hkube/consts');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const { createWarning } = require('../utils/warningCreator');
const { createJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { commands, components, consts } = require('../consts');
const component = components.RECONCILER;
const { WorkersManager, requestsManager } = require('./managers');

const { setWorkerImage, createContainerResource, setAlgorithmImage } = require('./createOptions');
const { matchJobsToResources, pauseAccordingToResources, parseResources } = require('./resources');
const { CPU_RATIO_PRESSURE, MEMORY_RATIO_PRESSURE } = consts;

const createdJobsLists = { batch: [], [stateType.Stateful]: [], [stateType.Stateless]: [] };

const unscheduledAlgorithms = {};
const ignoredunscheduledAlgorithms = {};

const _createJob = (jobDetails, options) => {
    const spec = createJobSpec({ ...jobDetails, options });
    const jobCreateResult = kubernetes.createJob({ spec, jobDetails });
    return jobCreateResult;
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

const _clearCreatedJobsLists = (options, now) => {
    const currentTime = now || Date.now();
    let removedCount = 0;

    Object.keys(createdJobsLists).forEach((key) => {
        const originalLength = createdJobsLists[key].length;
        createdJobsLists[key] = createdJobsLists[key].filter(
            (job) => currentTime - job.createdTime < options.createdJobsTTL
        );
        removedCount += originalLength - createdJobsLists[key].length;
    });

    if (removedCount > 0) {
        log.trace(`Removed ${removedCount} items from createdJobsLists`, { component });
    }
};

const _processAllRequests = (
    { idleWorkers, pausedWorkers, pendingWorkers, bootstrapWorkers, algorithmTemplates, versions, jobsCreated, normRequests, registry, clusterOptions, workerResources },
    { createDetails, reconcileResult, toResume, scheduledRequests }
) => {
    for (let r of normRequests) {// eslint-disable-line
        const { algorithmName, hotWorker } = r;

        // Check for idle workers
        const idleWorkerIndex = idleWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (idleWorkerIndex !== -1) {
            // there is idle worker ready for work, no need to create new one.
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
            // there is a job which was recently created.
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

        // Check for bootstrapped workers
        const bootstrapWorkerIndex = bootstrapWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (bootstrapWorkerIndex !== -1) {
            // there is a worker in bootstrap for this algorithm.
            const [worker] = bootstrapWorkers.splice(bootstrapWorkerIndex, 1);
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

        const { kind, workerEnv, algorithmEnv, labels, annotations, version: algorithmVersion, nodeSelector, stateType: algorithmStateType = 'batch',
            entryPoint, options: algorithmOptions, reservedMemory, mounts, env, sideCars, volumes, volumeMounts, kaiObject } = algorithmTemplate;

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
                volumeMounts,
                kaiObject,
                stateType: algorithmStateType
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
                resumed workers: ${resumed}, required: ${required}.`, { component });
        }
        reconcileResult[algorithmName].active = ws.count;
    });
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, workers, jobs, pods, versions, normResources, registry, options, clusterOptions, workerResources } = {}) => {
    // Update the cache of jobs lately created by removing old jobs
    _clearCreatedJobsLists(options);
    _checkResourcePressure(normResources);

    const workersManager = new WorkersManager(workers, jobs, pods, algorithmTemplates, versions, registry);
    requestsManager.prepareAlgorithmRequests(algorithmRequests, algorithmTemplates, workersManager.mergedWorkers, workersManager.categorizedWorkers);

    // Initialize result variables
    const createDetails = [];
    const reconcileResult = {};
    const toResume = [];
    const scheduledRequests = [];

    const jobsCreated = clonedeep(Object.values(createdJobsLists).flat());

    const batchCount = workersManager.countBatchWorkers(algorithmTemplates, createdJobsLists.batch.length);
    requestsManager.updateCapacity(batchCount);

    _processAllRequests({
        ...workersManager.categorizedWorkers, algorithmTemplates, versions, jobsCreated, normRequests: requestsManager.finalRequests, registry, clusterOptions, workerResources
    }, { createDetails, reconcileResult, toResume, scheduledRequests });

    // Handle job creation and scheduling
    const allVolumesNames = await _getAllVolumeNames();
    const existingQueuesNames = await kubernetes.getAllQueueNames();
    const extraResources = { allVolumesNames, existingQueuesNames };
    const { requested, skipped } = matchJobsToResources(createDetails, normResources, scheduledRequests, extraResources);

    // if couldn't create all, try to stop some workers
    const stopDetails = [];
    _findWorkersToStop({ skipped, ...workersManager.categorizedWorkers, algorithmTemplates, scheduledRequests }, { stopDetails });

    const { toStop } = pauseAccordingToResources(stopDetails, normResources, skipped);

    if (requested.length > 0) {
        log.trace(`trying to create ${requested.length} algorithms....`, { component });
    }

    // log.info(`to stop: ${JSON.stringify(toStop.map(s => ({ n: s.algorithmName, id: s.id })))}, toResume: ${JSON.stringify(toResume.map(s => ({ n: s.algorithmName, id: s.id })))} `);
    const toStopFiltered = _filterWorkersToStop(toStop, toResume);

    // log.info(`to stop: ${JSON.stringify(toStopFiltered.map(s => ({ n: s.algorithmName, id: s.id })))}, toResume: ${JSON.stringify(toResume.map(s => ({ n: s.algorithmName, id: s.id })))} `);
    const created = await _processPromises({ 
        ...workersManager, toStopFiltered, toResume, skipped, requested, options 
    });
    created.forEach(job => createdJobsLists[job.stateType].push(job));

    const unScheduledObject = _checkUnscheduled(created, skipped, requestsManager.maxFilteredRequests, unscheduledAlgorithms, ignoredunscheduledAlgorithms, algorithmTemplates);
    const { unScheduledAlgorithms, ignoredUnScheduledAlgorithms } = unScheduledObject;

    // add created and skipped info
    const workerStats = _calcStats(workersManager.normWorkers);
    await _updateReconcileResult({
        reconcileResult, unScheduledAlgorithms, ignoredUnScheduledAlgorithms, created, skipped, toStop, toResume, workerStats, normResources
    });

    return reconcileResult;
};

module.exports = {
    reconcile,
    _clearCreatedJobsLists
};
