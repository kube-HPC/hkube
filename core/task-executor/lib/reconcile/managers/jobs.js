const clonedeep = require('lodash.clonedeep');
const { warningCodes, stateType } = require('@hkube/consts');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const kubernetes = require('../../helpers/kubernetes');
const etcd = require('../../helpers/etcd');
const component = 'JobsManager';
const { commands } = require('../../consts');
const { createJobSpec } = require('../../jobs/jobCreator');
const { createWarning } = require('../../utils/warningCreator');
const { setWorkerImage, createContainerResource, setAlgorithmImage } = require('../createOptions');
const { matchJobsToResources, pauseAccordingToResources, parseResources } = require('../resources');

class JobsManager {
    constructor() {
        this.createdJobsLists = { batch: [], [stateType.Stateful]: [], [stateType.Stateless]: [] };
        this.scheduledRequests = [];
        this.unScheduledAlgorithms = {};
        this.ignoredUnScheduledAlgorithms = {};
        this.jobsInfo = {
            created: [], skipped: [], toResume: [], toStop: []
        };
    }

    async finalizeScheduling(WorkersStateManager, algorithmTemplates, normResources, maxFilteredRequests, versions, requests, registry, clusterOptions, workerResources, options, reconcileResult) {
        const jobsCreated = clonedeep(Object.values(this.createdJobsLists).flat());

        const { createDetails, toResume } = this._processAllRequests({
            ...WorkersStateManager.workerCategories, algorithmTemplates, versions, jobsCreated, requests, registry, clusterOptions, workerResources
        }, reconcileResult);

        // Handle job creation and scheduling
        const extraResources = await this._getExtraResources();
        const { requested, skipped } = matchJobsToResources(createDetails, normResources, this.scheduledRequests, extraResources);
        
        // if couldn't create all, try to stop some workers
        const stopDetails = this._findWorkersToStop({ skipped, ...WorkersStateManager.workerCategories, algorithmTemplates });
    
        const toStop = pauseAccordingToResources(stopDetails, normResources, skipped);
    
        if (requested.length > 0) {
            log.trace(`trying to create ${requested.length} algorithms....`, { component });
        }

        // log.info(`toStop: ${JSON.stringify(toStop.map(s => ({ n: s.algorithmName, id: s.id })))}, toResume: ${JSON.stringify(toResume.map(s => ({ n: s.algorithmName, id: s.id })))} `);
        const toStopFiltered = this._filterWorkersToStop(toStop, toResume);
    
        // log.info(`toStop filtered: ${JSON.stringify(this.toStop.map(s => ({ n: s.algorithmName, id: s.id })))}, toResume: ${JSON.stringify(toResume.map(s => ({ n: s.algorithmName, id: s.id })))}`);
        const created = await this._processPromises({ 
            ...WorkersStateManager, options, toResume, toStopFiltered, requested, skipped
        });
        created.forEach(job => this.createdJobsLists[job.stateType].push(job));

        this._checkUnscheduled(created, skipped, maxFilteredRequests, algorithmTemplates);

        this.jobsInfo.created = created;
        this.jobsInfo.skipped = skipped;
        this.jobsInfo.toResume = toResume;
        this.jobsInfo.toStop = toStopFiltered;
    }

    clearCreatedJobsLists(createdJobsTTL, now) {
        const currentTime = now || Date.now();
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

    _processAllRequests(
        { idleWorkers, pausedWorkers, pendingWorkers, bootstrapWorkers, algorithmTemplates, versions, jobsCreated, requests, registry, clusterOptions, workerResources },
        reconcileResult
    ) {
        const createDetails = [];
        const toResume = [];
        for (let r of requests) {// eslint-disable-line
            const { algorithmName, hotWorker } = r;

            // Check for idle workers
            const idleWorkerIndex = idleWorkers.findIndex(w => w.algorithmName === algorithmName);
            if (idleWorkerIndex !== -1) {
                // there is idle worker ready for work, no need to create new one.
                const [worker] = idleWorkers.splice(idleWorkerIndex, 1);
                this.scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
                continue;
            }

            // Check for pending workers
            const pendingWorkerIndex = pendingWorkers.findIndex(w => w.algorithmName === algorithmName);
            if (pendingWorkerIndex !== -1) {
                // there is a pending worker.
                const [worker] = pendingWorkers.splice(pendingWorkerIndex, 1);
                this.scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
                continue;
            }

            // Check for recently creates jobs
            const jobsCreatedIndex = jobsCreated.findIndex(w => w.algorithmName === algorithmName);
            if (jobsCreatedIndex !== -1) {
                // there is a job which was recently created.
                const [worker] = jobsCreated.splice(jobsCreatedIndex, 1);
                this.scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
                continue;
            }

            // Check for paused workers
            const pausedWorkerIndex = pausedWorkers.findIndex(w => w.algorithmName === algorithmName);
            if (pausedWorkerIndex !== -1) {
                // there is paused worker. wake it up
                toResume.push({ ...(pausedWorkers[pausedWorkerIndex]) });
                const [worker] = pausedWorkers.splice(pausedWorkerIndex, 1);
                this.scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
                continue;
            }

            // Check for bootstrapped workers
            const bootstrapWorkerIndex = bootstrapWorkers.findIndex(w => w.algorithmName === algorithmName);
            if (bootstrapWorkerIndex !== -1) {
                // there is a worker in bootstrap for this algorithm.
                const [worker] = bootstrapWorkers.splice(bootstrapWorkerIndex, 1);
                this.scheduledRequests.push({ algorithmName: r.algorithmName, id: worker.id });
                continue;
            }

            // Build request to create new worker job (if no suitable workers found)
            const algorithmTemplate = algorithmTemplates[algorithmName];
            const { workerCustomResources } = algorithmTemplates[algorithmName];
            const algorithmImage = setAlgorithmImage(algorithmTemplate, versions, registry);
            const workerImage = setWorkerImage(algorithmTemplate, versions, registry);
            const resourceRequests = createContainerResource(algorithmTemplate);
            const workerResourceRequests = createContainerResource(workerResources);

            const { kind, workerEnv, algorithmEnv, labels, annotations, version: algorithmVersion, nodeSelector, stateType: algorithmStateType = 'batch',
                entryPoint, options: algorithmOptions, reservedMemory, mounts, env, sideCars, volumes, volumeMounts, kaiObject } = algorithmTemplate;

            // Add request details for new job creation (will need to get confirmation via matchJobsToResources)
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
        return { createDetails, toResume };
    }

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

    _findWorkersToStop({ skipped, idleWorkers, activeWorkers, algorithmTemplates }) {
        const missingCount = skipped.length;
        if (missingCount === 0) {
            return [];
        }
        const stopDetails = [];
    
        // find stats about required workers
        // log.info(`totalCapacityNow=${totalCapacityNow}, missingCount=${missingCount}`);
    
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
    
        skippedLocal.forEach((s) => {
            let skippedResources = parseResources(s);
            const needMoreResources = ({ requestedCpu, memoryRequests, requestedGpu }) => {
                return requestedCpu > 0 || memoryRequests > 0 || requestedGpu > 0;
            };
    
            const _subtractResources = (resources, { requestedCpu, memoryRequests, requestedGpu }) => {
                const newResources = {
                    requestedCpu: resources.requestedCpu - requestedCpu,
                    memoryRequests: resources.memoryRequests - memoryRequests,
                    requestedGpu: resources.requestedGpu - requestedGpu
                };
                return newResources;
            };
    
            while ((idleWorkersLocal.length > 0 || notUsedWorkers.length > 0 || usedWorkers.length > 0) && needMoreResources(skippedResources)) {
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
                    skippedResources = _subtractResources(skippedResources, parseResources(toStop.details));
                    stopDetails.push(toStop);
                }
            }
        });
        return stopDetails;
    }

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

    // Function to process promises for worker actions (stopping, warming, cooling, etc.)
    async _processPromises({ workersToExit, workersToWarmUp, requested, skipped, toStopFiltered, toResume, workersToCoolDown, options }) {
        const created = [];
        const exitWorkersPromises = workersToExit.map(r => this._exitWorker(r));
        const warmUpPromises = workersToWarmUp.map(r => this._warmUpWorker(r));
        const coolDownPromises = workersToCoolDown.map(r => this._coolDownWorker(r));
        const stopPromises = toStopFiltered.map(r => this._stopWorker(r));
        const resumePromises = toResume.map(r => this._resumeWorker(r));
        const createPromises = [];
        requested.forEach(jobDetails => createPromises.push(this._createJob(jobDetails, options)));

        const resolvedPromises = await Promise.all([...createPromises, ...stopPromises, ...exitWorkersPromises, ...warmUpPromises, ...coolDownPromises, ...resumePromises]);
        createPromises.forEach((_, index) => {
            const response = resolvedPromises[index];
        
            if (response && response.statusCode === 422) {
                const { jobDetails, message, spec } = response;
                const warning = createWarning({ jobDetails, code: warningCodes.JOB_CREATION_FAILED, message, spec });
        
                skipped.push({
                    ...jobDetails,
                    warning
                });
            }
            else if (response.statusCode === 200 || response.statusCode === 201) {
                created.push(response.jobDetails);
            }
        });
        return created;
    }

    _exitWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.exit, message: worker.message, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    _warmUpWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.warmUp, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    _coolDownWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.coolDown, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    _stopWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.stopProcessing, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    _resumeWorker(worker) {
        return etcd.sendCommandToWorker({
            workerId: worker.id, command: commands.startProcessing, algorithmName: worker.algorithmName, podName: worker.podName
        });
    }

    _createJob(jobDetails, options) {
        const spec = createJobSpec({ ...jobDetails, options });
        const jobCreateResult = kubernetes.createJob({ spec, jobDetails });
        return jobCreateResult;
    }

    /**
     * This method check for algorithms that cannot be scheduled.
     * We are using an algorithms map of <algorithm-name> --> <warning>.
     * The logic is as follows:
     * 1) iterate over the skipped algorithms and update the map.
     * 2) iterate over the algorithms map and check if we have a
     *    created, requested or deletion of an algorithm.
     * 3) if we found such an algorithm, we delete it from map.
     * 4) each iteration we update the discovery with the current map.
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

module.exports = new JobsManager();
