const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { createJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const component = require('../../common/consts/componentNames').RECONCILER;
/**
 * normalizes the worker info from discovery
 * input will look like:
 * <code>
 * {
 *  '/discovery/workers/worker-uuid':{
 *      algorithmName,
 *      workerStatus,
 *      jobStatus,
 *      error
 *      },
 *  '/discovery/workers/worker-uuid2':{
 *      algorithmName,
 *      workerStatus,
 *      jobStatus,
 *      error
 *      }
 * }
 * </code>
 * normalized output should be:
 * <code>
 * {
 *   worker-uuid:{
 *     algorithmName,
 *     workerStatus // ready, working
 * 
 *   }
 * }
 * </code>
 * @param {*} workers 
 */

const normalizeWorkers = (workers) => {
    if (workers == null) {
        return [];
    }
    const workersArray = Object.entries(workers).map(([k, v]) => {
        const workerId = k.match(/([^/]*)\/*$/)[0];
        return {
            id: workerId,
            algorithmName: v.algorithmName,
            workerStatus: v.workerStatus,
            podName: v.podName
        };
    });
    return workersArray;
};


const normalizeRequests = (requests) => {
    if (requests == null) {
        return [];
    }
    return requests.map(r => ({ algorithmName: r.alg, pods: r.data.pods }));
};

const normalizeJobs = (jobsRaw) => {
    if (jobsRaw == null) {
        return [];
    }
    const jobs = jobsRaw.body.items.map(j => ({
        name: j.metadata.name,
        algorithmName: j.metadata.labels['algorithm-name'],
        active: j.status.active === 1
    }));
    return jobs;
};

const mergeWorkers = (workers, jobs) => {
    const foundJobs = [];
    const mergedWorkers = workers.map((w) => {
        const jobForWorker = jobs.find(j => w.podName.startsWith(j.name));
        if (jobForWorker) {
            foundJobs.push(jobForWorker.name);
        }
        return { ...w, job: jobForWorker ? { ...jobForWorker } : undefined };
    });

    const extraJobs = jobs.filter((job) => {
        return !foundJobs.find(j => j === job.name);
    });
    return { mergedWorkers, extraJobs };
};

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
    // return `${imageName}:${version.tag}`;
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
    return worker.algorithmName === algorithmName && worker.ready;
};

const _deleteJobs = (jobs) => {
    log.debug(`deleting ${jobs.length} dangling jobs`, { component });
    return jobs.map(j => kubernetes.deleteJob(j.name));
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
        const workersForAlgorithm = merged.mergedWorkers.filter(_idleWorkerFilter);
        reconcileResult[algorithmName] = {
            required: r.pods,
            actual: workersForAlgorithm.length
        };
        const podDiff = workersForAlgorithm.length - r.pods;
        if (podDiff > 0) {
            // need to stop some workers
            log.debug(`need to stop ${podDiff} pods for algorithm ${algorithmName}`);
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
    // if (merged.extraJobs) {
    //     const deletePromises = _deleteJobs(merged.extraJobs);
    //     deletePromises.forEach(p => createPromises.push(p));
    // }

    await Promise.all(createPromises);
    return reconcileResult;
};

module.exports = {
    normalizeWorkers,
    normalizeRequests,
    normalizeJobs,
    mergeWorkers,
    reconcile,
};
