const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { createJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { workerCommands } = require('../../common/consts/states');
const component = require('../../common/consts/componentNames').RECONCILER;
const { normalizeWorkers, normalizeRequests, normalizeJobs, mergeWorkers, normalizeResources } = require('./normalize');
const { setWorkerImage, createContainerResource, setAlgorithmImage } = require('./createOptions');
const { matchJobsToResources } = require('./resources');
const { CPU_RATIO_PRESURE, MEMORY_RATIO_PRESURE } = require('../../common/consts/consts');

const _createJob = async (jobDetails) => {
    const spec = createJobSpec(jobDetails);
    const jobCreateResult = kubernetes.createJob({ spec });
    return jobCreateResult;
};


const _pendingJobsFilter = (job, algorithmName) => {
    const match = job.algorithmName === algorithmName;
    return match;
};
const _idleWorkerFilter = (worker, algorithmName) => {
    const match = worker.algorithmName === algorithmName && worker.workerStatus === 'ready' && !worker.workerPaused;
    return match;
};
const _pausedWorkerFilter = (worker, algorithmName) => {
    const match = worker.algorithmName === algorithmName && worker.workerStatus === 'ready' && worker.workerPaused;
    return match;
};

const _stopWorkers = (workers, count) => {
    // sort workers so paused ones are in front
    const sorted = workers.slice().sort((a, b) => (b.workerPaused - a.workerPaused));
    const promises = sorted.slice(0, count).map((w) => {
        const workerId = w.id;
        return etcd.sendCommandToWorker({ workerId, command: workerCommands.stopProcessing });
    });
    return Promise.all(promises);
};

const _resumeWorkers = (workers, count) => {
    const sorted = workers.slice().sort((a, b) => (b.workerPaused - a.workerPaused));
    const promises = sorted.slice(0, count).map((w) => {
        const workerId = w.id;
        return etcd.sendCommandToWorker({ workerId, command: workerCommands.startProcessing });
    });
    return Promise.all(promises);
};


const reconcile = async ({ algorithmRequests, algorithmPods, jobs, versions, resources } = {}) => {
    const normPods = normalizeWorkers(algorithmPods);
    const normJobs = normalizeJobs(jobs, j => !j.status.succeeded);
    const merged = mergeWorkers(normPods, normJobs);
    const normRequests = normalizeRequests(algorithmRequests);
    const normResources = normalizeResources(resources);
    log.debug(`resources:\n${JSON.stringify(normResources, null, 2)}`);
    const isCpuPresure = normResources.allNodes.ratio.cpu > CPU_RATIO_PRESURE;
    const isMemoryPresure = normResources.allNodes.ratio.memory > MEMORY_RATIO_PRESURE;
    log.debug(`isCpuPresure: ${isCpuPresure}, isMemoryPresure: ${isMemoryPresure}`);

    const isResourcePresure = isCpuPresure || isMemoryPresure;
    const createDetails = [];
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

        if (podDiff > 0) {
            // need to stop some workers
            if (isResourcePresure) {
                log.debug(`need to stop ${podDiff} pods for algorithm ${algorithmName}`);
                _stopWorkers(workersForAlgorithm, podDiff);
            }
            else {
                log.debug(`resources ratio is: ${JSON.stringify(normResources.allNodes.ratio)}. no need to stop pods`);
            }
        }
        else if (podDiff < 0) {
            // need to add workers
            const numberOfNewJobs = -podDiff;

            log.debug(`need to add ${numberOfNewJobs} pods for algorithm ${algorithmName}`, { component });

            const algorithmTemplate = await etcd.getAlgorithmTemplate({ algorithmName }); // eslint-disable-line
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
    const { created, skipped } = matchJobsToResources(createDetails, normResources);
    createPromises.push(created.map(r => _createJob(r)));
    await Promise.all(createPromises);
    // add created and skipped info
    Object.entries(reconcileResult).forEach(([algorithmName, res]) => {
        res.created = created.filter(c => c.algorithmName === algorithmName).length;
        res.skipped = skipped.filter(c => c.algorithmName === algorithmName).length;
    });
    return reconcileResult;
};

module.exports = {
    reconcile,
};
