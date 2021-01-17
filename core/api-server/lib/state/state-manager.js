const Etcd = require('@hkube/etcd');
const storageManager = require('@hkube/storage-manager');
const { tracer } = require('@hkube/metrics');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const { buildStatuses } = require('@hkube/consts');
const component = require('../consts/componentNames').DB;

class StateManager {
    async init(options) {
        const log = Logger.GetLogFromContainer();
        this._etcd = new Etcd(options.etcd);
        await this._watch();
        await this._etcd.discovery.register({ serviceName: options.serviceName, data: options });
        log.info(`initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });

        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
    }

    async _watch() {
        await this._etcd.algorithms.builds.singleWatch();
        await this._etcd.jobs.results.singleWatch();
        await this._etcd.jobs.status.singleWatch();
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
        return this._db.algorithms.update(algorithm);
    }

    async getAlgorithm(payload) {
        return this._db.algorithms.fetch(payload);
    }

    async deleteAlgorithm({ name }) {
        return this._db.algorithms.delete({ name });
    }

    async getAlgorithms({ name, names, sort, limit } = {}) {
        return this._db.algorithms.search({
            name,
            names,
            sort: { created: sort },
            limit
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

    onJobResult(func) {
        this._etcd.jobs.results.on('change', (response) => {
            func(response);
        });
    }

    onJobStatus(func) {
        this._etcd.jobs.status.on('change', (response) => {
            func(response);
        });
    }

    releaseJobResultLock({ jobId }) {
        return this._etcd.jobs.results.releaseChangeLock({ jobId });
    }

    releaseJobStatusLock({ jobId }) {
        return this._etcd.jobs.status.releaseChangeLock({ jobId });
    }

    async createJob({ jobId, userPipeline, pipeline, status }) {
        await this._db.jobs.create({ jobId, userPipeline, pipeline, status });
        await this._etcd.jobs.status.set({ jobId, ...status });
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
        if (options && options.data && options.data.storageInfo) {
            try {
                const data = await storageManager.get(options.data.storageInfo, tracer.startSpan.bind(tracer, { name: 'storage-get-result' }));
                return { ...options, data, storageModule: storageManager.moduleName };
            }
            catch (error) {
                return { error: new Error(`failed to get from storage: ${error.message}`) };
            }
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
}

module.exports = new StateManager();
