const clonedeep = require('lodash.clonedeep');
const { StatusCodes } = require('http-status-codes');
const { warningCodes, stateType } = require('@hkube/consts');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const kubernetes = require('../../helpers/kubernetes');
const etcd = require('../../helpers/etcd');
const component = 'jobsHandler';
const { commands } = require('../../consts');
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
     * @param {Object} WorkersStateManager - Holds workers information lists.
     * @param {Object} algorithmTemplates - Algorithm definitions from DB.
     * @param {Object} normResources - Normalized cluster resources (CPU/Memory/GPU).
     * @param {Object} versions - System versions object.
     * @param {Object[]} maxFilteredRequests - Requests after max workers filtering.
     * @param {Object[]} requests - Requests selected for scheduling (final requests).
     * @param {Object} registry - Registry configuration.
     * @param {Object} clusterOptions - Cluster-wide configuration.
     * @param {Object} workerResources - Default worker resource requests.
     * @param {Object} options - Confguration containing additional job creation options.
     * @param {Object} reconcileResult - Scheduling reconcile stats by algorithm.
     */
    async finalizeScheduling(workersStateManager, algorithmTemplates, normResources, versions, requests, registry, clusterOptions, workerResources, options, reconcileResult) {
        // 1. Clone list of already created jobs (avoid mutating original)
        const jobsCreated = clonedeep(Object.values(this.createdJobsLists).flat());
        
        // 2. Assign requests to workers or prepare job creation details
        const { createDetails, toResume, scheduledRequests } = this._processAllRequests({
            ...workersStateManager.workerCategories, algorithmTemplates, versions, jobsCreated, requests, registry, clusterOptions, workerResources
        }, reconcileResult);

        // 3. Match jobs to resources, and skip those that doesn't have the required resources.
        const extraResources = await this._getExtraResources();
        const { toRequest, skipped } = matchJobsToResources(createDetails, normResources, scheduledRequests, extraResources);
        
        // 4. Find workers to stop if resources insufficient
        const stopDetails = this._findWorkersToStop({ skipped, ...workersStateManager.workerCategories, algorithmTemplates });
    
        // 5. Pause workers according to resource needs
        const toStop = pauseAccordingToResources(stopDetails, normResources, skipped);
    
        if (toRequest.length > 0) {
            log.trace(`trying to create ${toRequest.length} algorithms....`, { component });
        }

        // 6. Filter stop list to avoid stopping workers we plan to resume
        const toStopFiltered = this._filterWorkersToStop(toStop, toResume);
    
        // 7. Execute all actions (create jobs, stop, resume, warm/cool workers, etc.)
        const created = await this._processPromises({ 
            ...workersStateManager, options, toResume, toStopFiltered, toRequest, skipped
        });
        created.forEach(job => this.createdJobsLists[job.stateType].push(job));

        // 8. Update unscheduled algorithms tracking
        this._checkUnscheduled(created, skipped, requests, algorithmTemplates);

        // 9. Return jobs info for reporting
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
     * @param {Object} params - Combined parameters including workers lists, templates, etc.
     * @param {Object} reconcileResult - Scheduling stats by algorithm.
     * @returns {{createDetails: Object[], toResume: Object[]}} - Job creation details and workers to resume.
     */
    _processAllRequests(
        { idleWorkers, pausedWorkers, pendingWorkers, bootstrapWorkers, algorithmTemplates, versions, jobsCreated, requests, registry, clusterOptions, workerResources },
        reconcileResult
    ) {
        const createDetails = [];
        const toResume = [];
        const scheduledRequests = []; // Requests successfully matched to a worker or job

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
            const pendingWorkerIndex = pendingWorkers.findIndex(worker => worker.algorithmName === algorithmName);
            if (pendingWorkerIndex !== -1) {
                // there is a pending worker.
                const [worker] = pendingWorkers.splice(pendingWorkerIndex, 1);
                scheduledRequests.push({ algorithmName, id: worker.id });
                continue;
            }

            // Check for recently created jobs
            const jobsCreatedIndex = jobsCreated.findIndex(worker => worker.algorithmName === algorithmName);
            if (jobsCreatedIndex !== -1) {
                // there is a job which was recently created.
                const [worker] = jobsCreated.splice(jobsCreatedIndex, 1);
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
            const bootstrapWorkerIndex = bootstrapWorkers.findIndex(worker => worker.algorithmName === algorithmName);
            if (bootstrapWorkerIndex !== -1) {
                // there is a worker in bootstrap for this algorithm.
                const [worker] = bootstrapWorkers.splice(bootstrapWorkerIndex, 1);
                scheduledRequests.push({ algorithmName, id: worker.id });
                continue;
            }

            // No existing worker found — prepare job creation request
            const algorithmTemplate = algorithmTemplates[algorithmName];
            const { workerCustomResources } = algorithmTemplates[algorithmName];
            const algorithmImage = setAlgorithmImage(algorithmTemplate, versions, registry);
            const workerImage = setWorkerImage(algorithmTemplate, versions, registry);
            const resourceRequests = createContainerResource(algorithmTemplate);
            const workerResourceRequests = createContainerResource(workerResources);

            const { kind, workerEnv, algorithmEnv, labels, annotations, version: algorithmVersion, nodeSelector, stateType: algorithmStateType = 'batch',
                entryPoint, options: algorithmOptions, reservedMemory, mounts, env, sideCars, volumes, volumeMounts, kaiObject } = algorithmTemplate;

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
     * @param {Object} params - Contains skipped jobs, idle workers, active workers, and templates.
     * @returns {Object[]} Workers to stop with details.
     */
    _findWorkersToStop({ skipped, idleWorkers, activeWorkers, algorithmTemplates }) {
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
        return toStopFiltered;
    }

    /**
     * Executes create/stop/resume/warm/cool worker actions in parallel.
     *
     * @private
     * @returns {Promise<Object[]>} Successfully created jobs.
     */
    async _processPromises({ workersToExit, workersToWarmUp, toRequest, skipped, toStopFiltered, toResume, workersToCoolDown, options }) {
        const created = [];
        const exitWorkersPromises = workersToExit.map(r => this._exitWorker(r));
        const warmUpPromises = workersToWarmUp.map(r => this._warmUpWorker(r));
        const coolDownPromises = workersToCoolDown.map(r => this._coolDownWorker(r));
        const stopPromises = toStopFiltered.map(r => this._stopWorker(r));
        const resumePromises = toResume.map(r => this._resumeWorker(r));
        const createPromises = [];
        toRequest.forEach(jobDetails => createPromises.push(this._createJob(jobDetails, options)));

        const resolvedPromises = await Promise.all([...createPromises, ...stopPromises, ...exitWorkersPromises, ...warmUpPromises, ...coolDownPromises, ...resumePromises]);
        createPromises.forEach((_, index) => {
            const response = resolvedPromises[index]; // Thats fine because resolvedPromises first contains createPromises
        
            if (response && response.statusCode === StatusCodes.UNPROCESSABLE_ENTITY) {
                const { jobDetails, message, spec } = response;
                const warning = createWarning({ jobDetails, code: warningCodes.JOB_CREATION_FAILED, message, spec });
        
                skipped.push({
                    ...jobDetails,
                    warning
                });
            }
            else if (response.statusCode === StatusCodes.OK || response.statusCode === StatusCodes.CREATED) {
                created.push(response.jobDetails);
            }
        });
        return created;
    }

    /**
     * Sends an exit command to a worker, instructing it to terminate.
     *
     * @private
     * @param {Object} worker - Worker object.
     * @returns {Promise<Object>} Response from etcd.
     */
    _exitWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.exit, message: worker.message, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    /**
     * Sends a warm-up command to a worker, preparing it for execution.
     *
     * @private
     * @param {Object} worker - Worker object.
     * @returns {Promise<Object>} Response from etcd.
     */
    _warmUpWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.warmUp, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    /**
     * Sends a cool-down command to a worker, signaling it to reduce activity or release resources.
     *
     * @private
     * @param {Object} worker - Worker object.
     * @returns {Promise<Object>} Response from etcd.
     */
    _coolDownWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.coolDown, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    /**
     * Sends a stop-processing command to a worker, halting further job execution.
     *
     * @private
     * @param {Object} worker - Worker object.
     * @returns {Promise<Object>} Response from etcd.
     */
    _stopWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.stopProcessing, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    /**
     * Sends a start-processing command to a worker, resuming job execution.
     *
     * @private
     * @param {Object} worker - Worker object.
     * @returns {Promise<Object>} Response from etcd.
     */
    _resumeWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.startProcessing, algorithmName: worker.algorithmName, podName: worker.podName
        });
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
     * 2. Check if any of these algorithms have been created, requested, or removed from templates.
     * 3. Remove such algorithms from the map and move them to `ignoredUnScheduledAlgorithms`.
     *
     * @private
     * @param {Object[]} created - Successfully created jobs.
     * @param {Object[]} skipped - Jobs skipped due to insufficient resources or other reasons.
     * @param {Object[]} maxFilteredRequests - Requests after applying max workers filtering.
     * @param {Object} algorithmTemplates - Available algorithm templates.
     */
    _checkUnscheduled(created, skipped, maxFilteredRequests, algorithmTemplates) {
        skipped.forEach((s) => {
            if (!this.unScheduledAlgorithms[s.algorithmName]) {
                this.unScheduledAlgorithms[s.algorithmName] = s.warning;
            }
        });

        const algorithmsMap = Object.keys(this.unScheduledAlgorithms);
        if (algorithmsMap.length > 0) {
            const createdSet = new Set(created.map(x => x.algorithmName));
            const requestSet = new Set(maxFilteredRequests.map(x => x.algorithmName));
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
                }
            });
        }
    }
}

module.exports = new JobsHandler();
