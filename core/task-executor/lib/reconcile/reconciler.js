const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { createJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { workerCommands } = require('../../common/consts/states');
const component = require('../../common/consts/componentNames').RECONCILER;
const { normalizeWorkers, normalizeRequests, normalizeJobs, mergeWorkers } = require('./normalize');
const MAX_JOBS_PER_TICK = 30;

const _createJobs = async (numberOfJobs, jobDetails) => {
    log.debug(`need to add ${numberOfJobs} jobs with details ${JSON.stringify(jobDetails, null, 2)}`, { component });
    if (numberOfJobs > MAX_JOBS_PER_TICK) {
        numberOfJobs = MAX_JOBS_PER_TICK;
    }

    const results = Array.from(Array(numberOfJobs).keys()).map(() => {
        const spec = createJobSpec(jobDetails);
        const jobCreateResult = kubernetes.createJob({ spec });
        return jobCreateResult;
    });
    return Promise.all(results);
};


const _parseImageName = (image) => {
    const match = image.match(/^(?:([^/]+)\/)?(?:([^/]+)\/)?([^@:/]+)(?:[@:](.+))?$/);
    if (!match) return null;

    let registry = match[1];
    let namespace = match[2];
    const repository = match[3];
    let tag = match[4];

    if (!namespace && registry && !/[:.]/.test(registry)) {
        namespace = registry;
        registry = null;
    }

    const result = {
        registry: registry || null,
        namespace: namespace || null,
        repository,
        tag: tag || null
    };

    registry = registry ? registry + '/' : '';
    namespace = namespace && namespace !== 'library' ? namespace + '/' : '';
    tag = tag && tag !== 'latest' ? ':' + tag : '';

    result.name = registry + namespace + repository + tag;
    result.fullname = registry + (namespace || 'library/') + repository + (tag || ':latest');

    return result;
};

const _createImageName = ({ registry, namespace, repository, tag }, ignoreTag) => {
    let array = [registry, namespace, repository];
    array = array.filter(a => a);
    let image = array.join('/');
    if (tag && !ignoreTag) {
        image = `${image}:${tag}`;
    }
    return image;
};

const _setAlgorithmImage = (template, versions) => {
    const imageName = template.algorithmImage;
    const imageParsed = _parseImageName(imageName);
    if (imageParsed.tag) {
        return _createImageName(imageParsed);
    }
    const version = versions && versions.versions.find(p => p.project === imageParsed.repository);
    if (version && version.tag) {
        imageParsed.tag = version.tag;
    }
    return _createImageName(imageParsed);
};

const _setWorkerImage = (template, versions) => {
    const imageName = template.workerImage || 'hkube/worker';
    const imageParsed = _parseImageName(imageName);
    if (imageParsed.tag) {
        return _createImageName(imageParsed);
    }
    const version = versions && versions.versions.find(p => p.project === imageParsed.repository);
    if (version && version.tag) {
        imageParsed.tag = version.tag;
    }
    // return `${imageName}:${version.tag}`;
    return _createImageName(imageParsed);
};

const _pendingJobjsFilter = (job, algorithmName) => {
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


const reconcile = async ({ algorithmRequests, algorithmPods, jobs, versions } = {}) => {
    const normPods = normalizeWorkers(algorithmPods);
    const normJobs = normalizeJobs(jobs);
    const merged = mergeWorkers(normPods, normJobs);
    const normRequests = normalizeRequests(algorithmRequests);
    const createPromises = [];
    const reconcileResult = {};
    for (let r of normRequests) { // eslint-disable-line
        const { algorithmName } = r;
        // find workers currently for this algorithm
        const workersForAlgorithm = merged.mergedWorkers.filter(w => _idleWorkerFilter(w, algorithmName));
        const pausedWorkers = merged.mergedWorkers.filter(w => _pausedWorkerFilter(w, algorithmName));
        const pendingWorkers = merged.extraJobs.filter(j => _pendingJobjsFilter(j, algorithmName));
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
            log.debug(`need to stop ${podDiff} pods for algorithm ${algorithmName}`);
            _stopWorkers(workersForAlgorithm, podDiff);
        }
        else if (podDiff < 0) {
            // need to add workers
            const numberOfNewJobs = -podDiff;

            log.debug(`need to add ${numberOfNewJobs} pods for algorithm ${algorithmName}`, { component });

            const algorithmTemplate = await etcd.getAlgorithmTemplate({ algorithmName }); // eslint-disable-line
            const algorithmImage = _setAlgorithmImage(algorithmTemplate, versions);
            const workerImage = _setWorkerImage(algorithmTemplate, versions);
            createPromises.push(_createJobs(numberOfNewJobs, {
                algorithmName,
                algorithmImage,
                workerImage
            }));
        }
    }
    await Promise.all(createPromises);
    return reconcileResult;
};

module.exports = {
    reconcile,
};
