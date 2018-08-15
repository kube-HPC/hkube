const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const clonedeep = require('lodash.clonedeep');
const parse = require('@hkube/units-converter');
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

let createdJobsList = [];
const CREATED_JOBS_TTL = 5 * 1000;
const MIN_AGE_FOR_STOP = 10 * 1000;
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

const _idleWorkerFilter = (worker, algorithmName) => {
    let match = worker.workerStatus === 'ready' && !worker.paused;
    if (algorithmName) {
        match = match && worker.algorithmName === algorithmName;
    }
    return match;
};

const _pausedWorkerFilter = (worker, algorithmName) => {
    let match = worker.workerStatus === 'ready' && worker.paused;
    if (algorithmName) {
        match = match && worker.algorithmName === algorithmName;
    }
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

const _clearCreatedJobsList = (now) => {
    const newCreatedJobsList = createdJobsList.filter(j => (now || Date.now()) - j.createdTime < CREATED_JOBS_TTL);
    log.debug(`removed ${createdJobsList.length - newCreatedJobsList.length} items from jobCreated list`);
    createdJobsList = newCreatedJobsList;
};

const reconcile = async ({ algorithmTemplates, algorithmRequests, algorithmPods, jobs, versions, normResources } = {}) => {
    _clearCreatedJobsList();
    const normPods = normalizeWorkers(algorithmPods);
    const normJobs = normalizeJobs(jobs, j => !j.status.succeeded);
    const merged = mergeWorkers(normPods, normJobs);
    const normRequests = normalizeRequests(algorithmRequests);
    // log.debug(`resources:\n${JSON.stringify(normResources.allNodes, null, 2)}`);
    const isCpuPresure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESURE;
    const isMemoryPresure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESURE;
    log.debug(`isCpuPresure: ${isCpuPresure}, isMemoryPresure: ${isMemoryPresure}`);
    const createDetails = [];
    const createPromises = [];
    const reconcileResult = {};

    const idleWorkers = clonedeep(merged.mergedWorkers.filter(w => _idleWorkerFilter(w)));
    const pausedWorkers = clonedeep(merged.mergedWorkers.filter(w => _pausedWorkerFilter(w)));
    const pendingWorkers = clonedeep(merged.extraJobs);
    const jobsCreated = clonedeep(createdJobsList);


    for (let r of normRequests) {// eslint-disable-line
        const { algorithmName } = r;
        const idleWorkerIndex = idleWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (idleWorkerIndex !== -1) {
            // there is idle worker. don't do anything
            idleWorkers.splice(idleWorkerIndex, 1);
            continue; // eslint-disable-line
        }
        const pausedWorkerIndex = pausedWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (pausedWorkerIndex !== -1) {
            // there is paused worker. wake it up
            const workerId = pausedWorkers[pausedWorkerIndex].id;
            createPromises.push(etcd.sendCommandToWorker({ workerId, command: commands.startProcessing }));
            pausedWorkers.splice(pausedWorkerIndex, 1);
            continue; // eslint-disable-line
        }
        const pendingWorkerIndex = pendingWorkers.findIndex(w => w.algorithmName === algorithmName);
        if (pendingWorkerIndex !== -1) {
            // there is a pending worker.
            pendingWorkers.splice(pendingWorkerIndex, 1);
            continue; // eslint-disable-line
        }
        const jobsCreatedIndex = jobsCreated.findIndex(w => w.algorithmName === algorithmName);
        if (jobsCreatedIndex !== -1) {
            // there is a pending worker.
            jobsCreated.splice(jobsCreatedIndex, 1);
            continue; // eslint-disable-line
        }
        const algorithmTemplate = algorithmTemplates[algorithmName];
        const algorithmImage = setAlgorithmImage(algorithmTemplate, versions);
        const workerImage = setWorkerImage(algorithmTemplate, versions);
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
                resourceRequests
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
    }, {
        cpu: 0,
        memory: 0
    });
    if (skipped.length > 0) {
        idleWorkers.forEach((r) => {
            const algorithmTemplate = algorithmTemplates[r.algorithmName];
            const resourceRequests = createContainerResource(algorithmTemplate);
            stopDetails.push({
                count: 1,
                details: {
                    algorithmName: r.algorithmName,
                    resourceRequests
                }
            });
        });
    }

    const { toStop } = pauseAccordingToResources(
        stopDetails,
        normResources,
        idleWorkers.filter(w => Date.now() - w.job.startTime > MIN_AGE_FOR_STOP),
        resourcesToFree
    );
    const stopPromises = toStop.map(r => _stopWorker(r));

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
    // log.debug(`resources:\n${JSON.stringify(normResources, null, 2)}`);
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
    reconcileDrivers,
    _clearCreatedJobsList
};
