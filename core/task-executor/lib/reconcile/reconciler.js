const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const parse = require('@hkube/units-converter');
const { createJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { commands, components, consts, gpuVendors } = require('../../lib/consts');
const component = components.RECONCILER;

const { normalizeWorkers,
    normalizeHotRequests,
    normalizeHotWorkers,
    normalizeColdWorkers,
    normalizeRequests,
    normalizeJobs,
    mergeWorkers } = require('./normalize');

const { setWorkerImage, createContainerResource, setAlgorithmImage } = require('./createOptions');
const { matchJobsToResources, pauseAccordingToResources } = require('./resources');
const { CPU_RATIO_PRESURE, MEMORY_RATIO_PRESURE } = consts;

let createdJobsList = [];
const MIN_AGE_FOR_STOP = 10 * 1000;

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

const _clearCreatedJobsList = (now, options) => {
    const newCreatedJobsList = createdJobsList.filter(j => (now || Date.now()) - j.createdTime < options.createdJobsTTL);
    const items = createdJobsList.length - newCreatedJobsList.length;
    if (items > 0) {
        log.debug(`removed ${items} items from jobCreated list`, { component });
    }
    createdJobsList = newCreatedJobsList;
};

const _processAllRequests = (
    { idleWorkers, pausedWorkers, pendingWorkers, algorithmTemplates, versions, jobsCreated, normRequests, registry, clusterOptions },
    { createPromises, createDetails, reconcileResult }
) => {
    for (let r of normRequests) {// eslint-disable-line
        const { algorithmName, hotWorker } = r;
        const idleWorkerIndex = idleWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (idleWorkerIndex !== -1) {
            // there is idle worker. don't do anything
            idleWorkers.splice(idleWorkerIndex, 1);
            continue;
        }
        const pausedWorkerIndex = pausedWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (pausedWorkerIndex !== -1) {
            // there is paused worker. wake it up
            const workerId = pausedWorkers[pausedWorkerIndex].id;
            createPromises.push(etcd.sendCommandToWorker({ workerId, algorithmName, command: commands.startProcessing }));
            pausedWorkers.splice(pausedWorkerIndex, 1);
            continue;
        }
        const pendingWorkerIndex = pendingWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (pendingWorkerIndex !== -1) {
            // there is a pending worker.
            pendingWorkers.splice(pendingWorkerIndex, 1);
            continue;
        }
        const jobsCreatedIndex = jobsCreated.findIndex(w => w.algorithmName === algorithmName);
        if (jobsCreatedIndex !== -1) {
            // there is a pending worker.
            jobsCreated.splice(jobsCreatedIndex, 1);
            continue;
        }
        const algorithmTemplate = algorithmTemplates[algorithmName];
        const algorithmImage = setAlgorithmImage(algorithmTemplate, versions, registry);
        const workerImage = setWorkerImage(algorithmTemplate, versions, registry);
        const resourceRequests = createContainerResource(algorithmTemplate);
        const { workerEnv, algorithmEnv, nodeSelector, entryPoint } = algorithmTemplate;

        createDetails.push({
            numberOfNewJobs: 1,
            jobDetails: {
                algorithmName,
                algorithmImage,
                workerImage,
                workerEnv,
                algorithmEnv,
                nodeSelector,
                entryPoint,
                hotWorker,
                resourceRequests,
                clusterOptions
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

const _findWorkersToStop = ({ skipped, idleWorkers, activeWorkers, algorithmTemplates }, { stopDetails }) => {
    let missingCount = skipped.length;
    if (missingCount === 0) {
        return;
    }


    idleWorkers.forEach((r) => {
        const algorithmTemplate = algorithmTemplates[r.algorithmName];
        if (algorithmTemplate && algorithmTemplate.options && algorithmTemplate.options.debug) {
            return;
        }
        const resourceRequests = createContainerResource(algorithmTemplate);
        stopDetails.push({
            count: 1,
            details: {
                algorithmName: r.algorithmName,
                resourceRequests,
                nodeName: r.job ? r.job.nodeName : null,
                podName: r.podName,
                id: r.id


            }
        });
        missingCount -= 1;
    });

    const activeTypes = Object.entries(activeWorkers.reduce((prev, cur, index) => {
        if (!prev[cur.algorithmName]) {
            prev[cur.algorithmName] = {
                count: 0,
                list: []
            };
        }
        prev[cur.algorithmName].count += ((index + 1) ** 0.7);
        prev[cur.algorithmName].list.push(cur);
        return prev;
    }, {})).map(([k, v]) => ({ algorithmName: k, count: v.count, list: v.list }));
    const skippedTypes = Object.entries(skipped.reduce((prev, cur) => {
        if (!prev[cur.algorithmName]) {
            prev[cur.algorithmName] = {
                count: 0,
                list: []
            };
        }
        prev[cur.algorithmName].count += 1;
        prev[cur.algorithmName].list.push(cur);
        return prev;
    }, {})).map(([k, v]) => ({ algorithmName: k, count: v.count, list: v.list }));
    const notUsedAlgorithms = activeTypes.filter(w => !skippedTypes.find(d => d.algorithmName === w.algorithmName));


    notUsedAlgorithms.forEach((r) => {
        const algorithmTemplate = algorithmTemplates[r.algorithmName];
        if (algorithmTemplate && algorithmTemplate.options && algorithmTemplate.options.debug) {
            return;
        }
        const resourceRequests = createContainerResource(algorithmTemplate);
        r.list.forEach((w) => {
            stopDetails.push({
                count: 1,
                details: {
                    algorithmName: r.algorithmName,
                    resourceRequests,
                    nodeName: w.job ? w.job.nodeName : null,
                    podName: w.podName,
                    id: w.id

                }
            });
            missingCount -= 1;
        });
    });

    // if (missingCount === 0) {
    //     return;
    // }

    // const sortedActiveTypes = activeTypes.sort((a, b) => a.count - b.count);
    // sortedActiveTypes.forEach((r) => {
    //     const algorithmTemplate = algorithmTemplates[r.algorithmName];
    //     if (algorithmTemplate && algorithmTemplate.options && algorithmTemplate.options.debug) {
    //         return;
    //     }
    //     const resourceRequests = createContainerResource(algorithmTemplate);
    //     r.list.forEach((w) => {
    //         stopDetails.push({
    //             count: 1,
    //             details: {
    //                 algorithmName: r.algorithmName,
    //                 resourceRequests,
    //                 nodeName: w.job ? w.job.nodeName : null,
    //                 podName: w.podName,
    //                 id: w.id
    //             }
    //         });
    //         missingCount -= 1;
    //     });
    // });
};

const _calaStats = (data) => {
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
    // const resourcesWithWorkers = matchWorkersToNodes(localResources.nodeList, workers.map(w => ({
    //     algorithmName: w.algorithmName,
    //     nodeName: w.job.nodeName,
    //     workerStatus: w.workerStatus
    // })));
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
        workers: _calaStats(n.workers)

    }
    ));
    return statsPerNode;
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, workers, jobs, pods, versions, normResources, registry, options, clusterOptions } = {}) => {
    _clearCreatedJobsList(null, options);
    const normWorkers = normalizeWorkers(workers);
    const normJobs = normalizeJobs(jobs, pods, j => !j.status.succeeded);
    const merged = mergeWorkers(normWorkers, normJobs);
    const normRequests = normalizeRequests(algorithmRequests);
    const warmUpWorkers = normalizeHotWorkers(normWorkers, algorithmTemplates);
    const coolDownWorkers = normalizeColdWorkers(normWorkers, algorithmTemplates);
    const totalRequests = normalizeHotRequests(normRequests, algorithmTemplates);

    // log.debug(JSON.stringify(normResources.allNodes, null, 2));

    const isCpuPresure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESURE;
    const isMemoryPresure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESURE;
    if (isCpuPresure || isMemoryPresure) {
        log.debug(`isCpuPresure: ${isCpuPresure}, isMemoryPresure: ${isMemoryPresure}`, { component });
    }
    const createDetails = [];
    const createPromises = [];
    const reconcileResult = {};

    const idleWorkers = clonedeep(merged.mergedWorkers.filter(w => _idleWorkerFilter(w)));
    const activeWorkers = clonedeep(merged.mergedWorkers.filter(w => _activeWorkerFilter(w)));
    const pausedWorkers = clonedeep(merged.mergedWorkers.filter(w => _pausedWorkerFilter(w)));
    const pendingWorkers = clonedeep(merged.extraJobs);
    const jobsCreated = clonedeep(createdJobsList);

    _processAllRequests(
        {
            idleWorkers, pausedWorkers, pendingWorkers, normResources, algorithmTemplates, versions, jobsCreated, normRequests: totalRequests, registry, clusterOptions
        },
        {
            createPromises, createDetails, reconcileResult
        }
    );
    const { created, skipped } = matchJobsToResources(createDetails, normResources);
    created.forEach((j) => {
        createdJobsList.push(j);
    });

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
        skipped, idleWorkers, activeWorkers, algorithmTemplates
    }, { stopDetails });

    const { toStop } = pauseAccordingToResources(
        stopDetails,
        normResources,
        [...idleWorkers.filter(w => (w.job && Date.now() - w.job.startTime > MIN_AGE_FOR_STOP) && !w.hotWorker), ...activeWorkers.filter(w => !w.hotWorker)],
        resourcesToFree,
        skipped
    );

    if (created.length > 0) {
        log.debug(`creating ${created.length} algorithms....`, { component });
    }
    const warmUpPromises = warmUpWorkers.map(r => _warmUpWorker(r));
    const coolDownPromises = coolDownWorkers.map(r => _coolDownWorker(r));
    const stopPromises = toStop.map(r => _stopWorker(r));
    createPromises.push(created.map(r => _createJob(r, options)));

    await Promise.all([...createPromises, ...stopPromises, ...warmUpPromises, ...coolDownPromises]);
    // add created and skipped info
    Object.entries(reconcileResult).forEach(([algorithmName, res]) => {
        res.created = created.filter(c => c.algorithmName === algorithmName).length;
        res.skipped = skipped.filter(c => c.algorithmName === algorithmName).length;
        res.paused = toStop.filter(c => c.algorithmName === algorithmName).length;
    });
    await etcd.updateDiscovery({
        reconcileResult,
        actual: _calaStats(normWorkers),
        resourcePressure: {
            cpu: consts.CPU_RATIO_PRESURE,
            gpu: consts.GPU_RATIO_PRESURE,
            mem: consts.MEMORY_RATIO_PRESURE
        },
        nodes: _getNodeStats(normResources, merged.mergedWorkers)
    });
    return reconcileResult;
};

module.exports = {
    reconcile,
    _clearCreatedJobsList
};
