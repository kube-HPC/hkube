const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const parse = require('@hkube/units-converter');
const { createJobSpec, createDriverJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { awsAccessKeyId, awsSecretAccessKey, s3EndpointUrl } = require('../templates/s3-template');
const { fsBaseDirectory, fsVolumeMounts, fsVolumes } = require('../templates/fs-template');
const { commands, components, consts } = require('../../lib/consts');
const component = components.RECONCILER;

const { normalizeWorkers,
    normalizeDrivers,
    normalizeRequests,
    normalizeDriversRequests,
    normalizeJobs,
    normalizeDriversJobs,
    mergeWorkers,
    mergeDrivers,
    normalizeDriversAmount } = require('./normalize');

const { setWorkerImage, createContainerResource, setAlgorithmImage, setPipelineDriverImage } = require('./createOptions');
const { matchJobsToResources, pauseAccordingToResources } = require('./resources');
const { CPU_RATIO_PRESURE, MEMORY_RATIO_PRESURE } = consts;

let createdJobsList = [];
const MIN_AGE_FOR_STOP = 10 * 1000;

const _createJob = (jobDetails, options) => {
    const spec = createJobSpec({ ...jobDetails, options });
    const jobCreateResult = kubernetes.createJob({ spec });
    return jobCreateResult;
};

const _createDriverJob = (jobDetails, options) => {
    const spec = createDriverJobSpec({ ...jobDetails, options });
    const jobCreateResult = kubernetes.createJob({ spec });
    return jobCreateResult;
};

const _idleDriverFilter = (driver) => {
    const match = driver.status === 'ready' && !driver.paused;
    return match;
};

const _pausedDriverFilter = (driver) => {
    const match = driver.status === 'ready' && driver.paused;
    return match;
};

const _pendingDriverFilter = (job, algorithmName) => {
    const match = job.algorithmName === algorithmName;
    return match;
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

const _resumeWorkers = (workers, count) => {
    const sorted = workers.slice().sort((a, b) => (b.workerPaused - a.workerPaused));
    const promises = sorted.slice(0, count).map((w) => {
        const workerId = w.id;
        return etcd.sendCommandToWorker({ workerId, command: commands.startProcessing });
    });
    return Promise.all(promises);
};

const _stopWorker = (worker) => {
    return etcd.sendCommandToWorker({
        workerId: worker.id, command: commands.stopProcessing, algorithmName: worker.algorithmName, podName: worker.podName
    });
};

const _stopDriver = (driver) => {
    return etcd.sendCommandToDriver({ driverId: driver.id, command: commands.stopProcessing });
};

const _clearCreatedJobsList = (now, options) => {
    const newCreatedJobsList = createdJobsList.filter(j => (now || Date.now()) - j.createdTime < options.createdJobsTTL);
    const items = createdJobsList.length - newCreatedJobsList.length;
    if (items > 0) {
        log.debug(`removed ${items} items from jobCreated list`);
    }
    createdJobsList = newCreatedJobsList;
};

const _processAllRequests = (
    { idleWorkers, pausedWorkers, pendingWorkers, algorithmTemplates, versions, jobsCreated, normRequests, registry, clusterOptions },
    { createPromises, createDetails, reconcileResult }
) => {
    for (let r of normRequests) {// eslint-disable-line
        const { algorithmName } = r;
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
            createPromises.push(etcd.sendCommandToWorker({ workerId, command: commands.startProcessing }));
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
        const { workerEnv, algorithmEnv, } = algorithmTemplate;
        createDetails.push({
            numberOfNewJobs: 1,
            jobDetails: {
                algorithmName,
                algorithmImage,
                workerImage,
                workerEnv,
                algorithmEnv,
                resourceRequests,
                clusterOptions,
                awsAccessKeyId,
                awsSecretAccessKey,
                s3EndpointUrl,
                fsBaseDirectory,
                fsVolumeMounts,
                fsVolumes
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
                resourceRequests
            }
        });
        missingCount -= 1;
    });

    const activeTypes = Object.entries(activeWorkers.reduce((prev, cur, index) => {
        prev[cur.algorithmName] = (prev[cur.algorithmName] || 0) + ((index + 1) ** 0.7);
        return prev;
    }, {})).map(([k, v]) => ({ algorithmName: k, count: v }));
    const skippedTypes = Object.entries(skipped.reduce((prev, cur) => {
        prev[cur.algorithmName] = (prev[cur.algorithmName] || 0) + 1;
        return prev;
    }, {})).map(([k, v]) => ({ algorithmName: k, count: v }));
    const notUsedAlgorithms = activeTypes.filter(w => !skippedTypes.find(d => d.algorithmName === w.algorithmName));


    notUsedAlgorithms.forEach((r) => {
        const algorithmTemplate = algorithmTemplates[r.algorithmName];
        if (algorithmTemplate && algorithmTemplate.options && algorithmTemplate.options.debug) {
            return;
        }
        const resourceRequests = createContainerResource(algorithmTemplate);
        stopDetails.push({
            count: 1,
            details: {
                algorithmName: r.algorithmName,
                resourceRequests
            }
        });
        missingCount -= 1;
    });

    if (missingCount === 0) {
        return;
    }

    const sortedActiveTypes = activeTypes.sort((a, b) => a.count - b.count);
    sortedActiveTypes.forEach((r) => {
        const algorithmTemplate = algorithmTemplates[r.algorithmName];
        if (algorithmTemplate && algorithmTemplate.options && algorithmTemplate.options.debug) {
            return;
        }
        const resourceRequests = createContainerResource(algorithmTemplate);
        stopDetails.push({
            count: 1,
            details: {
                algorithmName: r.algorithmName,
                resourceRequests
            }
        });
        missingCount -= 1;
    });
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
        return acc;
    }, {}));

    return stats;
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, workers, jobs, versions, normResources, registry, options, clusterOptions } = {}) => {
    _clearCreatedJobsList(null, options);
    const normWorkers = normalizeWorkers(workers);
    const normJobs = normalizeJobs(jobs, j => !j.status.succeeded);
    const merged = mergeWorkers(normWorkers, normJobs);
    const normRequests = normalizeRequests(algorithmRequests);
    // log.debug(`algorithm requests ${normRequests.length}`);

    // log.debug(`resources:\n${JSON.stringify(normResources.allNodes, null, 2)}`);
    const isCpuPresure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESURE;
    const isMemoryPresure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESURE;
    if (isCpuPresure || isMemoryPresure) {
        log.debug(`isCpuPresure: ${isCpuPresure}, isMemoryPresure: ${isMemoryPresure}`);
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
            idleWorkers, pausedWorkers, pendingWorkers, normResources, algorithmTemplates, versions, jobsCreated, normRequests, registry, clusterOptions
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
            memory: prev.memory + parse.getMemoryInMi(cur.resourceRequests.requests.memory)
        };
    }, { cpu: 0, memory: 0 });

    _findWorkersToStop({
        skipped, idleWorkers, activeWorkers, algorithmTemplates
    }, { stopDetails });

    const { toStop } = pauseAccordingToResources(
        stopDetails,
        normResources,
        [...idleWorkers.filter(w => w.job && Date.now() - w.job.startTime > MIN_AGE_FOR_STOP), ...activeWorkers],
        resourcesToFree
    );

    if (created.length > 0) {
        log.debug(`creating ${created.length} algorithms....`);
    }
    const stopPromises = toStop.map(r => _stopWorker(r));
    createPromises.push(created.map(r => _createJob(r, options)));

    await Promise.all([...createPromises, ...stopPromises]);
    // add created and skipped info
    Object.entries(reconcileResult).forEach(([algorithmName, res]) => {
        res.created = created.filter(c => c.algorithmName === algorithmName).length;
        res.skipped = skipped.filter(c => c.algorithmName === algorithmName).length;
        res.paused = toStop.filter(c => c.algorithmName === algorithmName).length;
    });
    await etcd.updateDiscovery({
        reconcileResult,
        actual: _calaStats(normWorkers)
    });
    return reconcileResult;
};

const reconcileDrivers = async ({ driverTemplates, driversRequests, drivers, jobs, versions, normResources, settings, registry, options, clusterOptions } = {}) => {
    const normDrivers = normalizeDrivers(drivers);
    const normJobs = normalizeDriversJobs(jobs, j => !j.status.succeeded);
    const merged = mergeDrivers(normDrivers, normJobs);
    const normRequests = normalizeDriversRequests(driversRequests);
    // log.debug(`resources:\n${JSON.stringify(normResources, null, 2)}`);
    const isCpuPresure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESURE;
    const isMemoryPresure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESURE;
    if (isCpuPresure || isMemoryPresure) {
        log.debug(`isCpuPresure: ${isCpuPresure}, isMemoryPresure: ${isMemoryPresure}`);
    }
    const driversAmount = normalizeDriversAmount(normJobs, normRequests, settings);

    // const isResourcePresure = isCpuPresure || isMemoryPresure;
    const createDetails = [];
    const stopDetails = [];
    const createPromises = [];
    const reconcileResult = {};
    for (let r of driversAmount) { // eslint-disable-line
        const { name } = r;
        // find drivers currently for this type
        const idleDrivers = merged.mergedDrivers.filter(w => _idleDriverFilter(w, name));
        const pausedDrivers = merged.mergedDrivers.filter(w => _pausedDriverFilter(w, name));
        const pendingDrivers = merged.extraJobs.filter(j => _pendingDriverFilter(j, name));
        reconcileResult[name] = {
            required: r.pods,
            idle: idleDrivers.length,
            paused: pausedDrivers.length,
            pending: pendingDrivers.length
        };
        let requiredCount = r.pods;
        if (requiredCount > 0 && pausedDrivers.length > 0) {
            const canWakeWorkersCount = requiredCount > pausedDrivers.length ? pausedDrivers.length : requiredCount;
            if (canWakeWorkersCount > 0) {
                log.debug(`waking up ${canWakeWorkersCount} pods for algorithm ${name}`, { component });
                createPromises.push(_resumeWorkers(pausedDrivers, canWakeWorkersCount));
                requiredCount -= canWakeWorkersCount;
            }
        }
        const podDiff = (idleDrivers.length + pendingDrivers.length) - requiredCount;
        const podDiffForDelete = idleDrivers.length - requiredCount;
        if (podDiffForDelete > 0) {
            // need to stop some drivers
            // if (isResourcePresure) {
            log.debug(`need to stop ${podDiffForDelete} pods for algorithm ${name}`);
            // _stopWorkers(workersForAlgorithm, 1);

            const driverTemplate = driverTemplates[name];
            const resourceRequests = createContainerResource(driverTemplate);

            stopDetails.push({
                count: podDiffForDelete,
                details: {
                    name,
                    resourceRequests
                }
            });
            // }
            // else {
            //     log.debug(`resources ratio is: ${JSON.stringify(normResources.allNodes.ratio)}. no need to stop pods`);
            // }
        }
        else if (podDiff < 0) {
            // need to add drivers
            const numberOfNewJobs = -podDiff;

            log.debug(`need to add ${numberOfNewJobs} pods for type ${name}`, { component });

            const driverTemplate = driverTemplates[name];
            const image = setPipelineDriverImage(driverTemplate, versions, registry);
            const resourceRequests = createContainerResource(driverTemplate);
            createDetails.push({
                numberOfNewJobs,
                jobDetails: {
                    name,
                    image,
                    resourceRequests,
                    clusterOptions,
                    awsAccessKeyId,
                    awsSecretAccessKey,
                    s3EndpointUrl,
                    fsBaseDirectory,
                    fsVolumeMounts,
                    fsVolumes
                }
            });
        }
    }
    const { toStop } = pauseAccordingToResources(stopDetails, normResources, merged.mergedDrivers);
    const stopPromises = toStop.map(r => _stopDriver(r));
    const { created, skipped } = matchJobsToResources(createDetails, normResources);
    createPromises.push(created.map(r => _createDriverJob(r, options)));
    await Promise.all([...createPromises, ...stopPromises]);
    // add created and skipped info
    Object.entries(reconcileResult).forEach(([name, res]) => {
        res.created = created.filter(c => c.name === name).length;
        res.skipped = skipped.filter(c => c.name === name).length;
        res.paused = toStop.filter(c => c.name === name).length;
    });
    return reconcileResult;
};

module.exports = {
    reconcile,
    reconcileDrivers,
    _clearCreatedJobsList
};
