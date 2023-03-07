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

class StateManager extends EventEmitter {
    constructor() {
        super();
        this._failedHealthcheckCount = 0;
    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        this._options = options;
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
                this.emit('job-result-change', result);
            }
        }
        catch (error) {
            log.throttle.warning(`Failed to run healthchecks: ${error.message}`, { component });
        }
        this._healthcheck();
    }

    async _watch() {
        this._etcd.watcher.on('error', (err, path) => {
            log.error(`etcd watcher for ${path} error: ${err.message}`, { component }, err);
            process.exit(1);
        });
        await this._etcd.algorithms.builds.watch();
        await this._etcd.jobs.results.watch();
        await this._etcd.jobs.status.watch();

        this._etcd.jobs.results.on('change', result => {
            this.emit('job-result-change', result);
            this._failedHealthcheckCount = 0;
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
        return this._db.algorithms.replace(algorithm);
    }

    async getAlgorithm(payload) {
        return this._db.algorithms.fetch(payload);
    }

    async deleteAlgorithm({ name, kind, keepOldVersion }) {
        return this._db.algorithms.delete({ name, kind, keepOldVersion });
    }

    async getAlgorithms({ name, names, kind, sort, limit } = {}) {
        return this._db.algorithms.search({
            name,
            names,
            kind,
            sort: { created: sort },
            limit
        });
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

    // Versions
    async createVersions(list) {
        return this._db.algorithms.versions.createMany(list);
    }

    async getVersion(version) {
        return this._db.algorithms.versions.fetch(version);
    }

    async getVersions({ name, limit, fields }) {
        return this._db.algorithms.versions.search({
            name,
            sort: { created: 'desc' },
            limit,
            fields
        });
    }

    async updateVersion(version) {
        return this._db.algorithms.versions.update(version);
    }

    async deleteVersion(version) {
        return this._db.algorithms.versions.delete(version);
    }

    async createVersion(version) {
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
        return this._db.pipelines.update(options);
    }

    async replacePipeline(options) {
        return this._db.pipelines.replace(options);
    }

    async deletePipeline({ name }) {
        return this._db.pipelines.delete({ name });
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
            func(response);
        });
    }

    async createJob({ jobId, userPipeline, pipeline, status, completion }) {
        await this._db.jobs.create({ jobId, userPipeline, pipeline, status, completion });
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
}

module.exports = new StateManager();
