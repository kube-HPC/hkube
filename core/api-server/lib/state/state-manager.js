/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const EventEmitter = require('events');
const Etcd = require('@hkube/etcd');
const storageManager = require('@hkube/storage-manager');
const { tracer } = require('@hkube/metrics');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
let log;
const { buildStatuses, pipelineStatuses } = require('@hkube/consts');
const component = require('../consts/componentNames').DB;
const leaderComponent = require('../consts/componentNames').LEADER_ELECTION;
const redisLock = require('../utils/redis-lock');

class StateManager extends EventEmitter {
    constructor() {
        super();
        this._failedHealthcheckCount = 0;
        this._isLeader = false;
        this._electionScheduled = false;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._options = options;
        this._leaderElection = options.leaderElection;
        redisLock.init(options);
        await this._initLeaderElection();
        this._etcd = new Etcd(options.etcd);
        await this._watch();
        await this._etcd.discovery.register({ serviceName: options.serviceName, data: options });
        log.info(`initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });

        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init({ createIndices: true });
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
        this._healthcheck();
    }

    checkHealth(maxFailed) {
        return this._failedHealthcheckCount < maxFailed;
    }

    _healthcheck() {
        if (this._options.healthchecks.checkInterval) {
            setTimeout(() => {
                this._healthcheckInterval();
            }, this._options.healthchecks.checkInterval);
        }
    }

    async _healthcheckInterval() {
        // Detecting stuck completed jobs and re-emitting their result change is a singleton
        // side effect, so only the leader runs it. Followers re-arm the interval and return,
        // so this pod resumes the work on its next tick if it later becomes leader.
        if (!this._isLeader) {
            this._healthcheck();
            return;
        }
        try {
            const running = await this.getNotCompletedJobs();
            const completedToDelete = [];
            for (const { jobId, result, status: reportedStatus } of running) {
                if (result) {
                    const age = Date.now() - new Date(result.timestamp);
                    if (age > this._options.healthchecks.minAge) {
                        completedToDelete.push({ jobId, ...result, reportedStatus: reportedStatus?.status });
                    }
                }
            }
            if (completedToDelete.length) {
                log.info(`found ${completedToDelete.length} completed jobs`, { component });
                this._failedHealthcheckCount += 1;
            }
            for (const result of completedToDelete) {
                await this._emitJobResultChange(result);
            }
        }
        catch (error) {
            log.throttle.warning(`Failed to run healthchecks: ${error.message}`, { component });
        }
        this._healthcheck();
    }

    // Distributed leader election. On init every instance runs one election; whichever wins
    // owns the leader key. The leader then renews the key TTL on a fixed heartbeat (every
    // renewInterval), so leadership stays stable and does not depend on event traffic.
    // Failover, when the leader stops renewing and its key disappears, is driven two ways:
    //   1. fast path - a Redis keyspace notification (del/expired) on the key triggers an
    //      election immediately.
    //   2. backup    - a periodic existence check (every backupInterval) triggers an election
    //      when the key is missing, covering environments where keyspace notifications are
    //      unavailable or a notification was missed.
    // Each election waits a small random jitter before acquiring, to spread concurrent
    // attempts from multiple instances.
    async _initLeaderElection() {
        const { lockTtl, renewInterval, backupInterval, jitter } = this._leaderElection;
        log.info(`starting leader election (lockTtl: ${lockTtl}ms, renewInterval: ${renewInterval}ms, backupInterval: ${backupInterval}ms, jitter: ${jitter}ms)`, { component: leaderComponent });

        // Initial election on init.
        await this._renewLeadership('init');

        // Heartbeat: the current leader keeps renewing the key TTL.
        this._leaderRenewalInterval = setInterval(() => this._leaderHeartbeat(), renewInterval);
        this._leaderRenewalInterval.unref();

        // Backup safety net: re-elect if the leader key is gone.
        this._leaderBackupInterval = setInterval(() => this._backupLeaderCheck(), backupInterval);
        this._leaderBackupInterval.unref();

        // Fast path: react to del/expired keyspace notifications on the leader key.
        try {
            await redisLock.watchKeyRemoval(redisLock.LEADER_KEY, (event) => this._scheduleElection(`keyspace-${event}`));
        }
        catch (error) {
            log.warning(`failed to subscribe to leader key notifications, using backup check only: ${error.message}`, { component: leaderComponent });
        }
    }

    // Heartbeat tick: only the leader renews. Followers stay idle here and rely on the
    // keyspace notification or the backup check to elect when the leader key disappears.
    async _leaderHeartbeat() {
        if (!this._isLeader) {
            return;
        }
        await this._renewLeadership('heartbeat');
    }

    // Acquire the leader key, or renew its TTL if already owned, and log leadership changes.
    async _renewLeadership(reason) {
        try {
            const wasLeader = this._isLeader;
            this._isLeader = await redisLock.acquireOrRenew(redisLock.LEADER_KEY, this._leaderElection.lockTtl);
            if (this._isLeader && !wasLeader) {
                log.info(`became leader (reason: ${reason}, instanceId: ${redisLock.instanceId})`, { component: leaderComponent });
            }
            else if (!this._isLeader && wasLeader) {
                log.warning(`lost leadership (reason: ${reason})`, { component: leaderComponent });
                // Stuck-job detection is leader-only, so drop any strikes from this leadership
                // term. Otherwise, if this pod is re-elected, stale strikes could trip the
                // healthcheck and restart it prematurely. Only the current leader carries a count.
                this._failedHealthcheckCount = 0;
            }
        }
        catch (error) {
            log.throttle.warning(`failed to renew leader lock: ${error.message}`, { component: leaderComponent });
        }
    }

    // Backup safety net (every backupInterval): when the leader key is missing, schedule a
    // jittered election so a new leader is elected even if keyspace notifications were missed.
    async _backupLeaderCheck() {
        try {
            const exists = await redisLock.exists(redisLock.LEADER_KEY);
            if (!exists) {
                log.info('backup check: leader key is missing', { component: leaderComponent });
                this._scheduleElection('backup-check');
            }
        }
        catch (error) {
            log.throttle.warning(`backup leader check failed: ${error.message}`, { component: leaderComponent });
        }
    }

    // Run an election after a small random jitter (0..jitter ms) to spread simultaneous
    // attempts across instances, coalescing repeated triggers so only one runs at a time.
    _scheduleElection(reason) {
        if (this._electionScheduled) {
            return;
        }
        this._electionScheduled = true;
        const delay = Math.floor(Math.random() * (this._leaderElection.jitter + 1));
        log.info(`scheduling leader election in ${delay}ms (reason: ${reason})`, { component: leaderComponent });
        setTimeout(() => {
            this._electionScheduled = false;
            this._renewLeadership(`election:${reason}`);
        }, delay).unref();
    }

    // Whether this instance currently holds the distributed leader lock.
    isLeader() {
        return this._isLeader === true;
    }

    // Only the leader dispatches job-result-change events, so across multiple instances each
    // job completion is handled (webhooks, job completion) exactly once.
    _emitJobResultChange(result) {
        if (!this._isLeader) {
            return;
        }
        this.emit('job-result-change', result);
    }

    async _watch() {
        this._etcd.watcher.on('error', (err, path) => {
            log.error(`etcd watcher for ${path} error: ${err.message}`, { component }, err);
            process.exit(1);
        });
        await this._etcd.algorithms.builds.watch();
        await this._etcd.jobs.results.watch();
        await this._etcd.jobs.status.watch();

        this._etcd.jobs.results.on('change', (result) => {
            this._failedHealthcheckCount = 0;
            this._emitJobResultChange(result);
        });
    }

    async setPipelineDriversSettings(data) {
        return this._db.pipelineDrivers.update(data);
    }

    // Algorithms
    async createAlgorithms(list) {
        return this._db.algorithms.createMany(list);
    }

    async updateAlgorithm(payload) {
        const algorithm = payload;
        if (!algorithm.created) {
            algorithm.created = Date.now();
        }
        algorithm.modified = Date.now();
        if (algorithm.auditTrail && algorithm?.auditTrail[0]) {
            algorithm.auditTrail[0].timestamp = algorithm.modified;
        }
        return this._db.algorithms.replace(algorithm);
    }

    async getAlgorithm(payload) {
        return this._db.algorithms.fetch(payload);
    }

    async deleteAlgorithm({ name, kind, keepOldVersions }) {
        return this._db.algorithms.delete({ name, kind, keepOldVersions });
    }

    async getAlgorithms({ name, names, kind, sort, limit } = {}) {
        const allAlgorithms = await this._db.algorithms.search({
            name,
            names,
            kind,
            sort: { created: sort },
            limit
        });
        // This section handles algorithms that are not satisfied, which may occur when a job is not scheduled yet.
        // May occur because resources missing (CPU / memory / GPU) or any other reason.
        const discoveryTaskExecutor = await this.getSystemResources();
        const unScheduled = { ...discoveryTaskExecutor[0]?.unScheduledAlgorithms };
        const updatedAlgorithms = allAlgorithms.map(algo => {
            const unscheduledReason = unScheduled[algo.name] ? unScheduled[algo.name].message : undefined;
            if (unscheduledReason) {
                return { ...algo, unscheduledReason };
            }
            const { unscheduledReason: _, ...rest } = algo;
            return rest;
        });
        return updatedAlgorithms;
    }

    async searchAlgorithms({ name, kind, algorithmImage, pending, cursor, page, sort, limit, fields } = {}) {
        return this._db.algorithms.searchApi({
            name, kind, algorithmImage, isPending: pending, cursor, page, sort, limit, fields
        });
    }

    async getAlgorithmsMapByNames({ names }) {
        if (!names?.length) {
            return new Map();
        }
        const algorithms = await this.getAlgorithms({ names });
        const algorithmsMap = new Map(algorithms.map((a) => [a.name, a]));
        return algorithmsMap;
    }

    // Versions of algorithms and pipelines
    async createVersions(list, isPipeline = false) {
        if (isPipeline) {
            return this._db.pipelines.versions.createMany(list);
        }
        return this._db.algorithms.versions.createMany(list);
    }

    async getVersion(version, isPipeline = false) {
        if (isPipeline) {
            return this._db.pipelines.versions.fetch(version);
        }
        return this._db.algorithms.versions.fetch(version);
    }

    async getVersions({ name, limit, fields }, isPipeline = false) {
        const argument = {
            name,
            sort: { created: 'desc' },
            limit,
            fields
        };
        if (isPipeline) {
            return this._db.pipelines.versions.search(argument);
        }
        return this._db.algorithms.versions.search(argument);
    }

    async updateVersion(version, isPipeline = false) {
        if (isPipeline) {
            return this._db.pipelines.versions.update(version);
        }
        return this._db.algorithms.versions.update(version);
    }

    async deleteVersion(version, isPipeline = false) {
        if (isPipeline) {
            return this._db.pipelines.versions.delete(version);
        }
        return this._db.algorithms.versions.delete(version);
    }

    async createVersion(version, isPipeline = false) {
        if (isPipeline) {
            return this._db.pipelines.versions.create(version);
        }
        return this._db.algorithms.versions.create(version);
    }

    // Builds
    async createBuilds(list) {
        return this._db.algorithms.builds.createMany(list);
    }

    async getBuild({ buildId }) {
        return this._db.algorithms.builds.fetch({ buildId });
    }

    async getBuilds({ algorithmName, sort, limit }) {
        return this._db.algorithms.builds.search({
            algorithmName,
            sort: { startTime: sort },
            limit
        });
    }

    async createBuild(build) {
        await this._db.algorithms.builds.create(build);
        await this._etcd.algorithms.builds.set(build);
    }

    async updateBuild(build) {
        await this._db.algorithms.builds.update(build);
        await this._etcd.algorithms.builds.update(build);
    }

    onBuildComplete(func) {
        this._etcd.algorithms.builds.on('change', (build) => {
            // Singleton side effect (version creation + algorithm update): leader only, so
            // multiple replicas watching the same build do not race or duplicate versions.
            if (!this._isLeader) {
                return;
            }
            if (build.status === buildStatuses.COMPLETED) {
                func(build);
            }
        });
    }

    // Pipelines
    async createPipelines(list) {
        return this._db.pipelines.createMany(list);
    }

    async deletePipelines(list) {
        return this._db.pipelines.deleteMany(list);
    }

    async searchPipelines({ experimentName, algorithmName, hasPipelinesTriggers, hasCronTriggers, hasCronEnabled, fields, sort, limit }) {
        return this._db.pipelines.search({
            experimentName,
            algorithmName,
            hasPipelinesTriggers,
            hasCronTriggers,
            hasCronEnabled,
            fields,
            sort,
            limit
        });
    }

    async updatePipeline(options) {
        const pipeline = options;
        if (!pipeline.created) {
            pipeline.created = Date.now();
        }
        pipeline.modified = Date.now();
        if (pipeline.auditTrail && pipeline?.auditTrail[0]?.timestamp) {
            pipeline.auditTrail[0].timestamp = pipeline.modified;
        }
        return this._db.pipelines.update(options);
    }

    async replacePipeline(options) {
        return this._db.pipelines.replace(options);
    }

    async deletePipeline({ name, keepOldVersions }) {
        return this._db.pipelines.delete({ name, keepOldVersions });
    }

    async getPipeline(options) {
        return this._db.pipelines.fetch(options);
    }

    async getPipelines({ pipelinesNames } = {}) {
        return this._db.pipelines.search({ pipelinesNames });
    }

    async insertPipeline(options) {
        return this._db.pipelines.create(options);
    }

    // Experiments
    async createExperiments(list) {
        return this._db.experiments.createMany(list);
    }

    async getExperiment({ name }) {
        return this._db.experiments.fetch({ name });
    }

    async getExperiments({ sort, limit }) {
        return this._db.experiments.fetchAll({
            query: {},
            sort: { created: sort },
            limit
        });
    }

    async createExperiment(experiment) {
        return this._db.experiments.create(experiment);
    }

    async deleteExperiment({ name }) {
        return this._db.experiments.delete({ name });
    }

    // ReadMe
    async createPipelinesReadMe(list) {
        return this._db.pipelines.readme.createMany(list);
    }

    async createAlgorithmsReadMe(list) {
        return this._db.algorithms.readme.createMany(list);
    }

    async getPipelineReadMe({ name }) {
        return this._db.pipelines.readme.fetch({ name });
    }

    async updatePipelineReadMe({ name, data }) {
        return this._db.pipelines.readme.update({ name, data });
    }

    async deletePipelineReadMe({ name }) {
        return this._db.pipelines.readme.delete({ name });
    }

    async getAlgorithmReadMe({ name }) {
        return this._db.algorithms.readme.fetch({ name });
    }

    async updateAlgorithmReadMe({ name, data }) {
        return this._db.algorithms.readme.update({ name, data });
    }

    async deleteAlgorithmReadMe({ name }) {
        return this._db.algorithms.readme.delete({ name });
    }

    // Jobs
    async createJobs(list) {
        return this._db.jobs.createMany(list);
    }

    onJobStatus(func) {
        this._etcd.jobs.status.on('change', (response) => {
            // Singleton side effect (progress/status webhook): leader only, so the webhook is
            // delivered once across replicas instead of once per pod.
            if (!this._isLeader) {
                return;
            }
            func(response);
        });
    }

    async createJob({ jobId, externalId, userPipeline, pipeline, status, completion, auditTrail }) {
        await this._db.jobs.create({ jobId, externalId, userPipeline, pipeline, status, completion, auditTrail });
        await this._etcd.jobs.status.set({ jobId, ...status });
    }

    async getJob({ jobId, fields }) {
        return this._db.jobs.fetch({ jobId, fields });
    }

    async getRunningJobs({ status } = {}) {
        const statuses = status ? [status] : [pipelineStatuses.ACTIVE, pipelineStatuses.PENDING];
        return this._db.jobs.search({ pipelineStatus: { $in: statuses }, fields: { jobId: true, status: 'status.status', pipelineName: 'pipeline.name' } });
    }

    async getNotCompletedJobs() {
        return this._db.jobs.fetchAll({
            query: {
                completion: false,
                result: { $exists: true }
            },
            fields: {
                jobId: true,
                result: true,
                'status.status': true
            },
            excludeId: true
        });
    }

    async getStatus(status) {
        return this._db.jobs.fetchStatus(status);
    }

    async geAuditTrail({ jobId }) {
        return this._db.jobs.fetchAuditTrail({ jobId });
    }

    async getJobPipeline({ jobId }) {
        return this._db.jobs.fetchPipeline({ jobId });
    }

    async updateJobStatus(status) {
        await this._db.jobs.updateStatus(status);
        await this._etcd.jobs.status.update(status);
    }

    async updateJobResult(result) {
        await this._db.jobs.updateResult(result);
        await this._etcd.jobs.results.set(result);
    }

    async getJobResult(options) {
        const result = await this._db.jobs.fetchResult(options);
        return this.getResultFromStorage(result);
    }

    async getJobResultClean(options) {
        return this._db.jobs.fetchResult(options);
    }

    async mergeJobStorageResults(list) {
        return Promise.all(list.map(r => this.getResultFromStorage(r)));
    }

    async getResultFromStorage(options) {
        if (options?.data?.storageInfo) {
            let data;
            let error;
            try {
                data = await storageManager.get(options.data.storageInfo, tracer.startSpan.bind(tracer, { name: 'storage-get-result' }));
            }
            catch (e) {
                error = `failed to get from storage: ${e.message}`;
            }
            return { ...options, error, data, storageModule: storageManager.moduleName };
        }
        return options;
    }

    async searchJobs({ experimentName, pipelineName, pipelineType, algorithmName, hasResult, fields, sort, limit }) {
        return this._db.jobs.search({
            experimentName,
            pipelineName,
            pipelineType,
            algorithmName,
            hasResult,
            fields,
            sort,
            limit
        });
    }

    async searchJobsAPI({ query, cursor, pageNum, sort, limit, fields, exists }) {
        return this._db.jobs.searchApi({ query, cursor, pageNum, sort, limit, fields, exists });
    }

    // TriggersTree
    async getTriggersTree({ jobId }) {
        return this._db.triggersTree.fetch({ jobId });
    }

    async updateTriggersTree({ name, rootJobName, jobId, rootJobId, parentJobId }) {
        return this._db.triggersTree.update({ name, rootJobName, jobId, rootJobId, parentJobId });
    }

    // Webhooks
    async getResultWebhook({ jobId }) {
        return this._db.webhooks.result.fetch({ jobId });
    }

    async getStatusWebhook({ jobId }) {
        return this._db.webhooks.status.fetch({ jobId });
    }

    async updateResultWebhook(webhook) {
        return this._db.webhooks.result.update(webhook);
    }

    async updateStatusWebhook(webhook) {
        return this._db.webhooks.status.update(webhook);
    }

    // Tensorboards
    async getTensorboard({ id }) {
        return this._db.tensorboards.fetch({ id });
    }

    async getTensorboards() {
        return this._db.tensorboards.fetchAll();
    }

    async deleteTensorboard({ id }) {
        return this._db.tensorboards.delete({ id });
    }

    async createTensorboard(board) {
        return this._db.tensorboards.create(board);
    }

    async updateTensorboard(board) {
        return this._db.tensorboards.update(board);
    }

    async getAlgorithmsQueueList() {
        return this._etcd.algorithms.queue.list();
    }

    // Tensorboards
    async getOptunaboard({ id }) {
        return this._db.optunaboards.fetch({ id });
    }

    async getOptunaboards() {
        return this._db.optunaboards.fetchAll();
    }

    async deleteOptunaboard({ id }) {
        return this._db.optunaboards.delete({ id });
    }

    async createOptunaboard(board) {
        return this._db.optunaboards.create(board);
    }

    async updateOptunaboard(board) {
        return this._db.optunaboards.update(board);
    }

    async cleanJob({ jobId }) {
        await Promise.all([
            this._etcd.jobs.results.delete({ jobId }),
            this._etcd.jobs.status.delete({ jobId }),
            this._etcd.jobs.tasks.delete({ jobId }),
        ]);
    }

    async getSystemResources() {
        return this._etcd.discovery.list({ serviceName: 'task-executor' });
    }

    async updateJobCompletion({ jobId, completion }) {
        return this._db.jobs.patch({ query: { jobId }, data: { completion } });
    }

    async setGracefulJobs({ algorithmName, jobIds }) {
        return this._etcd.algorithms.graceful.set({ name: algorithmName, jobIds });
    }

    async deleteGracefulJobs({ algorithmName }) {
        return this._etcd.algorithms.graceful.delete({ name: algorithmName });
    }

    async getGracefulJobs({ algorithmName }) {
        const result = await this._etcd.algorithms.graceful.get({ name: algorithmName });
        return result ? result.jobIds || [] : [];
    }
}

module.exports = new StateManager();
