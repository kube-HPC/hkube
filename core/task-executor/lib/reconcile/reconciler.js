const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { createJobSpec, createDriverJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { commands } = require('../../common/consts/states');
const component = require('../../common/consts/componentNames').RECONCILER;
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
const { CPU_RATIO_PRESURE, MEMORY_RATIO_PRESURE } = require('../../common/consts/consts');

const _createJob = (jobDetails) => {
    const spec = createJobSpec(jobDetails);
    const jobCreateResult = kubernetes.createJob({ spec });
    return jobCreateResult;
};

const _createDriverJob = (jobDetails) => {
    const spec = createDriverJobSpec(jobDetails);
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

const _pendingJobsFilter = (job, algorithmName) => {
    const match = job.algorithmName === algorithmName;
    return match;
};

const _idleWorkerFilter = (worker, algorithmName) => {
    const match = worker.algorithmName === algorithmName && worker.workerStatus === 'ready' && !worker.paused;
    return match;
};

const _pausedWorkerFilter = (worker, algorithmName) => {
    const match = worker.algorithmName === algorithmName && worker.workerStatus === 'ready' && worker.paused;
    return match;
};

const _resumeWorkers = (workers, count) => {
    const sorted = workers.slice().sort((a, b) => (b.paused - a.paused));
    const promises = sorted.slice(0, count).map((w) => {
        const workerId = w.id;
        return etcd.sendCommandToWorker({ workerId, command: commands.startProcessing });
    });
    return Promise.all(promises);
};

const _stopWorker = (worker) => {
    return etcd.sendCommandToWorker({ workerId: worker.id, command: commands.stopProcessing });
};

const _stopDriver = (driver) => {
    return etcd.sendCommandToDriver({ driverId: driver.id, command: commands.stopProcessing });
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, algorithmPods, jobs, versions, normResources } = {}) => {
    const normPods = normalizeWorkers(algorithmPods);
    const normJobs = normalizeJobs(jobs, j => !j.status.succeeded);
    const merged = mergeWorkers(normPods, normJobs);
    const normRequests = normalizeRequests(algorithmRequests);
    log.debug(`resources:\n${JSON.stringify(normResources.allNodes, null, 2)}`);
    const isCpuPresure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESURE;
    const isMemoryPresure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESURE;
    log.debug(`isCpuPresure: ${isCpuPresure}, isMemoryPresure: ${isMemoryPresure}`);

    // const isResourcePresure = isCpuPresure || isMemoryPresure;
    const createDetails = [];
    const stopDetails = [];
    const createPromises = [];
    const reconcileResult = {};
    for (let r of normRequests) { // eslint-disable-line
        const { algorithmName } = r;
        // find workers currently for this algorithm
        const workersForAlgorithm = merged.mergedWorkers.filter(w => _idleWorkerFilter(w, algorithmName));
        const pausedWorkers = merged.mergedWorkers.filter(w => _pausedWorkerFilter(w, algorithmName));
        const pendingWorkers = merged.extraJobs.filter(j => _pendingJobsFilter(j, algorithmName));
        reconcileResult[algorithmName] = {
            required: r.pods,
            idle: workersForAlgorithm.length,
            paused: pausedWorkers.length,
            pending: pendingWorkers.length
        };
        let requiredCount = r.pods;
        if (requiredCount > 0 && pausedWorkers.length > 0) {
            const canWakeWorkersCount = requiredCount > pausedWorkers.length ? pausedWorkers.length : requiredCount;
            if (canWakeWorkersCount > 0) {
                log.debug(`waking up ${canWakeWorkersCount} pods for algorithm ${algorithmName}`, { component });
                createPromises.push(_resumeWorkers(pausedWorkers, canWakeWorkersCount));
                requiredCount -= canWakeWorkersCount;
            }
        }
        const podDiff = (workersForAlgorithm.length + pendingWorkers.length) - requiredCount;
        const podDiffForDelete = workersForAlgorithm.length - requiredCount;
        if (podDiffForDelete > 0) {
            // need to stop some workers
            // if (isResourcePresure) {
            log.debug(`need to stop ${podDiffForDelete} pods for algorithm ${algorithmName}`);
            // _stopWorkers(workersForAlgorithm, 1);
            const algorithmTemplate = algorithmTemplates[algorithmName];
            const resourceRequests = createContainerResource(algorithmTemplate);

            stopDetails.push({
                count: podDiffForDelete,
                details: {
                    algorithmName,
                    resourceRequests
                }
            });
            // }
            // else {
            //     log.debug(`resources ratio is: ${JSON.stringify(normResources.allNodes.ratio)}. no need to stop pods`);
            // }
        }
        else if (podDiff < 0) {
            // need to add workers
            const numberOfNewJobs = -podDiff;

            log.debug(`need to add ${numberOfNewJobs} pods for algorithm ${algorithmName}`, { component });

            const algorithmTemplate = algorithmTemplates[algorithmName];
            const algorithmImage = setAlgorithmImage(algorithmTemplate, versions);
            const workerImage = setWorkerImage(algorithmTemplate, versions);
            const resourceRequests = createContainerResource(algorithmTemplate);
            const { workerEnv, algorithmEnv, } = algorithmTemplate;
            createDetails.push({
                numberOfNewJobs,
                jobDetails: {
                    algorithmName,
                    algorithmImage,
                    workerImage,
                    workerEnv,
                    algorithmEnv,
                    resourceRequests
                }
            });
        }
    }
    const { toStop } = pauseAccordingToResources(stopDetails, normResources, merged.mergedWorkers);
    const stopPromises = toStop.map(r => _stopWorker(r));
    const { created, skipped } = matchJobsToResources(createDetails, normResources);
    createPromises.push(created.map(r => _createJob(r)));
    await Promise.all([...createPromises, ...stopPromises]);
    // add created and skipped info
    Object.entries(reconcileResult).forEach(([algorithmName, res]) => {
        res.created = created.filter(c => c.algorithmName === algorithmName).length;
        res.skipped = skipped.filter(c => c.algorithmName === algorithmName).length;
        res.paused = toStop.filter(c => c.algorithmName === algorithmName).length;
    });
    return reconcileResult;
};

/**
 * 
 * Known Issues:
 * 1) drivers requires large cpu, so resource manager don't allocate more than....
 * 
 */
const reconcileDrivers = async ({ driverTemplates, driversRequests, driversPods, jobs, versions, normResources, settings } = {}) => {
    const normPods = normalizeDrivers(driversPods);
    const normJobs = normalizeDriversJobs(jobs, j => !j.status.succeeded);
    const merged = mergeDrivers(normPods, normJobs);
    const normRequests = normalizeDriversRequests(driversRequests);
    log.debug(`resources:\n${JSON.stringify(normResources, null, 2)}`);
    const isCpuPresure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESURE;
    const isMemoryPresure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESURE;
    log.debug(`isCpuPresure: ${isCpuPresure}, isMemoryPresure: ${isMemoryPresure}`);

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
            const image = setPipelineDriverImage(driverTemplate, versions);
            const resourceRequests = createContainerResource(driverTemplate);
            createDetails.push({
                numberOfNewJobs,
                jobDetails: {
                    name,
                    image,
                    resourceRequests
                }
            });
        }
    }
    const { toStop } = pauseAccordingToResources(stopDetails, normResources, merged.mergedDrivers);
    const stopPromises = toStop.map(r => _stopDriver(r));
    const { created, skipped } = matchJobsToResources(createDetails, normResources);
    createPromises.push(created.map(r => _createDriverJob(r)));
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
    reconcileDrivers
};
