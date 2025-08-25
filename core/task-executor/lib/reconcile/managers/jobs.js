const clonedeep = require('lodash.clonedeep');
const { StatusCodes } = require('http-status-codes');
const { warningCodes, stateType } = require('@hkube/consts');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const kubernetes = require('../../helpers/kubernetes');
const component = require('../../consts').components.JOBS_HANDLER;
const { createJobSpec } = require('../../jobs/jobCreator');
const { createWarning } = require('../../utils/warningCreator');
const { setWorkerImage, createContainerResource, setAlgorithmImage } = require('../createOptions');
const { matchJobsToResources, pauseAccordingToResources, parseResources } = require('../resources');

/**
 * Manages job scheduling lifecycle, including matching requests to resources,
 * deciding worker stop/resume actions, and creating jobs when required.
 */
class JobsHandler {
    constructor() {
        // Jobs created by type
        this.createdJobsLists = { batch: [], [stateType.Stateful]: [], [stateType.Stateless]: [] };

        // Map of algorithmName -> warning for unscheduled algorithms
        this.unScheduledAlgorithms = {};

        // Map of ignored unscheduled algorithms
        this.ignoredUnScheduledAlgorithms = {};
    }

    /**
     * Finalizes job scheduling by processing requests, matching to resources, 
     * determining which workers to stop/resume, and creating jobs if needed.
     *
     * Process:
     * 1. Clone list of already created jobs.
     * 2. Process all requests:
     *    - Assign to idle, pending, recently created, paused, or bootstrap workers if possible.
     *    - Otherwise, prepare job creation details.
     * 3. Match prepared jobs to available cluster resources.
     * 4. If resources are insufficient, determine workers to stop and free resources.
     * 5. Filter out stop requests that conflict with resume requests.
     * 6. Execute all actions (create jobs, stop, resume, warm/cool workers, etc.).
     * 7. Update unscheduled algorithms map.
     * 8. Update jobsInfo with final scheduling data.
     *
     * @async
     * @param {Object} allAllocatedJobs - All allocated jobs with keys: idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, boostrappingWorkers.
     * @param {Object} algorithmTemplates - Algorithm definitions from DB.
     * @param {Object} normResources - Normalized cluster resources (CPU/Memory/GPU).
     * @param {Object} versions - System versions object.
     * @param {Object[]} requests - Requests selected for scheduling (final requests).
     * @param {Object} registry - Registry configuration.
     * @param {Object} clusterOptions - Cluster-wide configuration.
     * @param {Object} workerResources - Default worker resource requests.
     * @param {Object} options - Confguration containing additional job creation options.
     * @param {Object} reconcileResult - Scheduling reconcile stats by algorithm.
     */
    async schedule(allAllocatedJobs, algorithmTemplates, normResources, versions, requests, registry, clusterOptions, workerResources, options, reconcileResult) {        
        // 1. Assign requests to workers or prepare job creation details
        const { createDetails, toResume, scheduledRequests } = this._processAllRequests(allAllocatedJobs, algorithmTemplates,
            versions, requests, registry, clusterOptions, workerResources, reconcileResult);

        // 2. Match jobs to resources, and skip those that doesn't have the required resources.
        const extraResources = await this._getExtraResources();
        const { jobsToRequest, skipped } = matchJobsToResources(createDetails, normResources, scheduledRequests, extraResources);
        
        // 3. Find workers to stop if resources insufficient
        const stopDetails = this._findWorkersToStop(skipped, allAllocatedJobs, algorithmTemplates);
    
        // 4. Pause workers according to resource needs
        const toStop = pauseAccordingToResources(stopDetails, normResources, skipped);

        // 5. Filter stop list to avoid stopping workers we plan to resume
        const toStopFiltered = this._filterWorkersToStop(toStop, toResume);
    
        // 6. Execute all actions (create jobs, stop, resume, warm/cool workers, etc.)
        const { created, failed } = await this._createJobs(jobsToRequest, options);
        created.forEach(job => this.createdJobsLists[job.stateType].push(job));
        failed.forEach(job => skipped.push(job));

        // 7. Update unscheduled algorithms tracking
        this._checkUnscheduled(created, skipped, requests, algorithmTemplates);

        // 8. Return jobs info for reporting
        return { created, skipped, toResume, toStop: toStopFiltered };
    }

    /**
     * Removes jobs from createdJobsLists that exceed their TTL.
     *
     * @param {number} createdJobsTTL - Time-to-live in ms.
     * @param {number} [currentTime=Date.now()] - Current timestamp (optional for testing).
     */
    clearCreatedJobsLists(createdJobsTTL, currentTime = Date.now()) {
        let removedCount = 0;
    
        Object.keys(this.createdJobsLists).forEach((key) => {
            const originalLength = this.createdJobsLists[key].length;
            this.createdJobsLists[key] = this.createdJobsLists[key].filter(
                (job) => currentTime - job.createdTime < createdJobsTTL
            );
            removedCount += originalLength - this.createdJobsLists[key].length;
        });
    
        if (removedCount > 0) {
            log.trace(`Removed ${removedCount} items from createdJobsLists`, { component });
        }
    }

    /**
     * Processes all incoming requests, assigning them to available workers if possible.
     * If no suitable worker exists, prepares job creation details.
     *
     * @private
     * @param {Object} allAllocatedJobs - All allocated jobs with keys: idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, boostrappingWorkers.
     * @param {Array<Object>} allAllocatedJobs.idleWorkers - Idle workers list.
     * @param {Array<Object>} allAllocatedJobs.pausedWorkers - Paused workers list.
     * @param {Array<Object>} allAllocatedJobs.bootstrappingWorkers - bootstrappingWorkers workers list.
     * @param {Array<Object>} allAllocatedJobs.jobsPendingForWorkers - Jobs pending for workers list (jobs with no worker).
     * @param {Object} algorithmTemplates - Algorithm definitions from DB.
     * @param {Object} versions - System versions object.
     * @param {Object[]} requests - Requests selected for scheduling (final requests).
     * @param {Object} registry - Registry configuration.
     * @param {Object} clusterOptions - Cluster-wide configuration.
     * @param {Object} workerResources - Default worker resource requests.
     * @param {Object} reconcileResult - Scheduling reconcile stats by algorithm.
     * @returns {{createDetails: Object[], toResume: Object[], scheduledRequests: Object[]}} - Job creation details, workers to resume and all scheduled requests.
     */
    _processAllRequests(allAllocatedJobs, algorithmTemplates, versions, requests, registry, clusterOptions, workerResources, reconcileResult) {
        const createDetails = [];
        const toResume = [];
        const scheduledRequests = []; // Requests successfully matched to a worker or job
        const { idleWorkers, pausedWorkers, bootstrappingWorkers, jobsPendingForWorkers } = allAllocatedJobs;
        const alreadyCreatedJobs = clonedeep(Object.values(this.createdJobsLists).flat()); // avoid mutating original

        for (let req of requests) {// eslint-disable-line
            const { algorithmName, hotWorker } = req;

            // Check for idle worker
            const idleWorkerIndex = idleWorkers.findIndex(worker => worker.algorithmName === algorithmName);
            if (idleWorkerIndex !== -1) {
                // there is idle worker ready for work, no need to create new one.
                const [worker] = idleWorkers.splice(idleWorkerIndex, 1);
                scheduledRequests.push({ algorithmName, id: worker.id });
                continue;
            }

            // Check for pending worker
            const pendingWorkerIndex = jobsPendingForWorkers.findIndex(worker => worker.algorithmName === algorithmName);
            if (pendingWorkerIndex !== -1) {
                // there is a pending worker.
                const [worker] = jobsPendingForWorkers.splice(pendingWorkerIndex, 1);
                scheduledRequests.push({ algorithmName, id: worker.id });
                continue;
            }

            // Check for recently created jobs
            const jobsCreatedIndex = alreadyCreatedJobs.findIndex(worker => worker.algorithmName === algorithmName);
            if (jobsCreatedIndex !== -1) {
                // there is a job which was recently created.
                const [worker] = alreadyCreatedJobs.splice(jobsCreatedIndex, 1);
                scheduledRequests.push({ algorithmName, id: worker.id });
                continue;
            }

            // Check for paused worker
            const pausedWorkerIndex = pausedWorkers.findIndex(worker => worker.algorithmName === algorithmName);
            if (pausedWorkerIndex !== -1) {
                // there is paused worker. wake it up
                toResume.push({ ...(pausedWorkers[pausedWorkerIndex]) });
                const [worker] = pausedWorkers.splice(pausedWorkerIndex, 1);
                scheduledRequests.push({ algorithmName, id: worker.id });
                continue;
            }

            // Check for bootstrapped workers
            const bootstrapWorkerIndex = bootstrappingWorkers.findIndex(worker => worker.algorithmName === algorithmName);
            if (bootstrapWorkerIndex !== -1) {
                // there is a worker in bootstrap for this algorithm.
                const [worker] = bootstrappingWorkers.splice(bootstrapWorkerIndex, 1);
                scheduledRequests.push({ algorithmName, id: worker.id });
                continue;
            }

            // No existing worker found — prepare job creation request
            const algorithmTemplate = algorithmTemplates[algorithmName];
            const algorithmImage = setAlgorithmImage(algorithmTemplate, versions, registry);
            const workerImage = setWorkerImage(algorithmTemplate, versions, registry);
            const resourceRequests = createContainerResource(algorithmTemplate);
            const workerResourceRequests = createContainerResource(workerResources);

            const { kind, workerEnv, algorithmEnv, labels, annotations, version: algorithmVersion, nodeSelector,
                stateType: algorithmStateType = 'batch', entryPoint, options: algorithmOptions, reservedMemory,
                mounts, env, sideCars, volumes, volumeMounts, workerCustomResources, kaiObject } = algorithmTemplate;

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
        if (createDetails.length > 0) log.debug(`_processAllRequests - Got a total of ${createDetails.length} jobs create details out of ${requests.length} requests`, { component });
        return { createDetails, toResume, scheduledRequests };
    }

    /**
     * Retrieves additional Kubernetes resources (PVCs, ConfigMaps, Secrets, Kai Queues).
     *
     * @private
     * @returns {Promise<{allVolumesNames: Object, existingQueuesNames: string[]}>}
     */
    async _getExtraResources() {
        const allVolumesNames = await this._getAllVolumeNames();
        const existingQueuesNames = await kubernetes.getAllQueueNames();
        return { allVolumesNames, existingQueuesNames };
    }

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
    async _getAllVolumeNames() {
        const pvcs = await kubernetes.getAllPVCNames();
        const configMaps = await kubernetes.getAllConfigMapNames();
        const secrets = await kubernetes.getAllSecretNames();
        
        const volumesNames = { pvcs, configMaps, secrets };
        return volumesNames;
    }

    /**
     * Finds workers that can be stopped to free resources for skipped jobs.
     *
     * @private
     * @param {Object} skipped - Jobs that have been skipped (not scheduled).
     * @param {Object} allAllocatedJobs - All allocated jobs with keys: idleWorkers, activeWorkers, pausedWorkers, pendingWorkers, boostrappingWorkers.
     * @param {Array<Object>} allAllocatedJobs.idleWorkers - Idle workers list.
     * @param {Array<Object>} allAllocatedJobs.activeWorkers - Active workers list.
     * @param {Object} algorithmTemplates - Algorithm definitions from DB.
     * @returns {Object[]} Workers to stop with details.
     */
    _findWorkersToStop(skipped, allAllocatedJobs, algorithmTemplates) {
        const { idleWorkers, activeWorkers } = allAllocatedJobs;
        const missingCount = skipped.length;
        if (missingCount === 0) {
            return [];
        }
        const stopDetails = [];
    
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

        const __needMoreResources = ({ requestedCpu, memoryRequests, requestedGpu }) => {
            return requestedCpu > 0 || memoryRequests > 0 || requestedGpu > 0;
        };

        const __subtractResources = (resources, { requestedCpu, memoryRequests, requestedGpu }) => {
            const newResources = {
                requestedCpu: resources.requestedCpu - requestedCpu,
                memoryRequests: resources.memoryRequests - memoryRequests,
                requestedGpu: resources.requestedGpu - requestedGpu
            };
            return newResources;
        };
    
        skippedLocal.forEach((s) => {
            let skippedResources = parseResources(s);
    
            while ((idleWorkersLocal.length > 0 || notUsedWorkers.length > 0 || usedWorkers.length > 0) && __needMoreResources(skippedResources)) {
                let worker = idleWorkersLocal.shift();
                if (!worker) {
                    worker = notUsedWorkers.shift();
                }
                if (!worker) {
                    worker = usedWorkers.shift();
                }
                if (worker) {
                    activeWorkersLocal = activeWorkersLocal.filter(w => w.id !== worker.id);
                    const toStop = this._createStopDetails({ worker, algorithmTemplates });
                    skippedResources = __subtractResources(skippedResources, parseResources(toStop.details));
                    stopDetails.push(toStop);
                }
            }
        });
        if (stopDetails.length > 0) log.debug(`_findWorkersToStop - Identified ${stopDetails.length} candidate workers for stopping`, { component });
        return stopDetails;
    }

    /**
     * Builds stop request details for a given worker.
     *
     * @private
     * @param {Object} params - Worker and algorithmTemplates.
     * @returns {Object} Stop request details.
     */
    _createStopDetails({ worker, algorithmTemplates }) {
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
    }

    /**
     * Filters stop list to exclude workers that will be resumed.
     *
     * @private
     * @param {Object[]} toStop - Workers to stop.
     * @param {Object[]} toResume - Workers to resume.
     * @returns {Object[]} Filtered stop list.
     */
    _filterWorkersToStop(toStop, toResume) {
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
        if (toStopFiltered.length > 0) log.debug(`_filterWorkersToStop - ${toStopFiltered.length} workers marked for stopping`, { component });
        return toStopFiltered;
    }

    /**
     * Attempts to create multiple jobs in parallel.
     * 
     * For each job:
     * - If creation fails with an UNPROCESSABLE_ENTITY error, it is added to the `failed` list with a warning.
     * - If creation succeeds (status OK or CREATED), it is added to the `created` list.
     * 
     * @private
     * @async
     * @param {Array<Object>} jobsToRequest - List of job details to attempt to create.
     * @param {Object} options - Additional options passed to each job creation request.
     * 
     * @returns {Promise<{ created: Array<Object>, failed: Array<Object> }>} 
     *          An object containing arrays of successfully created and failed job details.
     */
    async _createJobs(jobsToRequest, options) {
        if (jobsToRequest.length > 0) log.trace(`_createJobs - Trying to create ${jobsToRequest.length} algorithms...`, { component });
        
        const created = [];
        const failed = [];
        const createPromises = [];
        jobsToRequest.forEach(jobDetails => createPromises.push(this._createJob(jobDetails, options)));
        const resolvedPromises = await Promise.all(createPromises);

        resolvedPromises.forEach(response => {        
            if (response && response.statusCode === StatusCodes.UNPROCESSABLE_ENTITY) {
                const { jobDetails, message, spec } = response;
                const warning = createWarning({ jobDetails, code: warningCodes.JOB_CREATION_FAILED, message, spec });
        
                failed.push({
                    ...jobDetails,
                    warning
                });
            }
            else if (response.statusCode === StatusCodes.OK || response.statusCode === StatusCodes.CREATED) {
                created.push(response.jobDetails);
            }
        });
        if (jobsToRequest.length > 0) log.debug(`_createJobs - Created ${created.length} jobs, failed creating ${failed.length} jobs`, { component });
        return { created, failed };
    }

    /**
     * Creates a Kubernetes job for the provided job details.
     *
     * @private
     * @param {Object} jobDetails - Job configuration and algorithm details.
     * @param {Object} options - Configuration with additional job creation options.
     * @returns {Promise<Object>} Result of job creation in Kubernetes.
     */
    _createJob(jobDetails, options) {
        const spec = createJobSpec({ ...jobDetails, options });
        const jobCreateResult = kubernetes.createJob({ spec, jobDetails });
        return jobCreateResult;
    }

    /**
     * Tracks algorithms that could not be scheduled and manages the unscheduled algorithms map.
     *
     * Logic:
     * 1. Add skipped algorithms to the `unScheduledAlgorithms` map if not already present.
     * 2. Check if any of these algorithms have been created, not requested anymore, or removed from templates.
     * 3. Remove such algorithms from the map and move them to `ignoredUnScheduledAlgorithms`.
     *
     * @private
     * @param {Object[]} created - Successfully created jobs.
     * @param {Object[]} skipped - Jobs skipped due to insufficient resources or other reasons.
     * @param {Object[]} requests - Algorithm requests.
     * @param {Object} algorithmTemplates - Available algorithm templates.
     */
    _checkUnscheduled(created, skipped, requests, algorithmTemplates) {
        const unScheduledCounters = { added: 0, removed: 0 };
        const ignoredStartingLength = this.ignoredUnScheduledAlgorithms.length;
        skipped.forEach((s) => {
            if (!this.unScheduledAlgorithms[s.algorithmName]) {
                this.unScheduledAlgorithms[s.algorithmName] = s.warning;
                unScheduledCounters.added += 1;
            }
        });

        const algorithmsMap = Object.keys(this.unScheduledAlgorithms);
        if (algorithmsMap.length > 0) {
            const createdSet = new Set(created.map(x => x.algorithmName));
            const requestSet = new Set(requests.map(x => x.algorithmName));
            algorithmsMap.forEach((k) => {
                const create = createdSet.has(k);
                const request = requestSet.has(k);
                // If algo was created, or not requested, or template missing, remove it from map and log it to etcd.
                if (create || !request || !algorithmTemplates[k]) {
                    this.ignoredUnScheduledAlgorithms = {
                        ...this.ignoredUnScheduledAlgorithms,
                        [k]: this.unScheduledAlgorithms[k]
                    };
                    delete this.unScheduledAlgorithms[k];
                    unScheduledCounters.removed += 1;
                }
            });
        }

        if (unScheduledCounters.added > 0) log.debug(`_checkUnscheduled - Added ${unScheduledCounters.added} algorithms to unScheduledAlgorithms`, { component });
        if (unScheduledCounters.removed > 0) log.debug(`_checkUnscheduled - Removed ${unScheduledCounters.removed} algorithms to unScheduledAlgorithms`, { component });
        if (this.ignoredUnScheduledAlgorithms.length > ignoredStartingLength) {
            log.debug(`_checkUnscheduled - Added ${this.ignoredUnScheduledAlgorithms.length - ignoredStartingLength} algorithms to ignoredUnScheduledAlgorithms`, { component });
        }
    }
}

module.exports = new JobsHandler();
