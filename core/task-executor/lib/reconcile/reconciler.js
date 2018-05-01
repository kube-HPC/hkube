const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { createJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { workerCommands, workerStates } = require('../../common/consts/states');
const component = require('../../common/consts/componentNames').RECONCILER;
const { normalizeWorkers, normalizeRequests, normalizeJobs, mergeWorkers } = require('./normalize');

const _createJobs = async (numberOfJobs, jobDetails) => {
    log.debug(`need to add ${numberOfJobs} jobs with details ${JSON.stringify(jobDetails, null, 2)}`, { component });
    const spec = createJobSpec(jobDetails);
    const jobCreateResult = await kubernetes.createJob({ spec });
    return jobCreateResult;
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

const _idleWorkerFilter = (worker, algorithmName) => {
    const match = worker.algorithmName === algorithmName && (worker.workerStatus === 'ready');
    // log.info(`_idleWorkerFilter: algorithmName: ${algorithmName}, worker: ${JSON.stringify(worker)}, match: ${match}`);
    return match;
};

const _sendCommandToWorkers = (workers, count, command) => {
    const promises = workers.slice(0, count).map((w) => {
        const workerId = w.id;
        return etcd.sendCommandToWorker({ workerId, command });
    });
    return Promise.all(promises);
};

const _stopWorkers = (workers, count) => {
    return _sendCommandToWorkers(workers, count, workerCommands.stopProcessing);
};

const _resumeWorkers = (workers, count) => {
    return _sendCommandToWorkers(workers, count, workerCommands.startProcessing);
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
        reconcileResult[algorithmName] = {
            required: r.pods,
            actual: workersForAlgorithm.length
        };
        const podDiff = workersForAlgorithm.length - r.pods;
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
