const Events = require('events');
const Etcd = require('@hkube/etcd');
const dbConnect = require('@hkube/db');
const Logger = require('@hkube/logger');
const pipelineStats = require('./get-pipeline-stats');
let log;
const ETCD_INTERVAL = 2000;
const MAX_ITEMS = 100;
const component = 'ETCD-Wrapper';
const allExperimentsName = 'show-all';

class DatabaseQuerier extends Events {
    constructor() {
        super();
        this.lastJobsByExperiment = Object.create(null);
        this.lastResults = Object.create(null);
        this.experimentList = ['main'];
        this._working = false;
    }

    async init(options) {
        this._options = options;
        log = Logger.GetLogFromContainer();
        this._client = new Etcd(options.etcd);
        const { provider, ...config } = options.db;
        this._db = dbConnect(config, provider);
        await this._db.init();
        log.info(`initializing etcd with options: ${JSON.stringify(options.etcd)}`, { component });
        log.info(`initialized mongo with options: ${JSON.stringify(this._db.config)}`, { component });
        this.etcdInterval();
    }

    etcdInterval() {
        setInterval(async () => {
            if (this._working) {
                return;
            }
            try {
                this._working = true;
                await this.getResult();
                await this._getDiscovery();
            }
            catch (error) {
                log.throttle.error(error.message, { component }, error);
            }
            finally {
                this._working = false;
            }
        }, ETCD_INTERVAL);
    }

    async getPodsByJobId(jobId) {
        const workers = await this._getDiscoveryType('worker');
        return workers.filter(w => w.jobId === jobId).map(w => w.podName);
    }

    updateExperimentList(experimentList) {
        this.experimentList = experimentList;
    }

    getLastResults() {
        return { jobs: this.lastJobsByExperiment, ...this.lastResults };
    }

    async getResult() {
        const [discovery] = await Promise.all([

            this._getDiscovery(),

        ]);
        this.lastResults = { discovery };

        return this.lastResults;
    }

    _experimentFilter(experimentName) {
        if (!experimentName || experimentName === allExperimentsName) {
            return undefined;
        }
        return experimentName;
    }

    getPipelinesStats() {
        return pipelineStats({ limit: 1000, db: this._db });
    }

    async getJobsForExperiment(experimentName) {
        const experiment = this._experimentFilter(experimentName);
        const jobs = await this._db.jobs.getPipelines({
            experimentName: experiment,
            limit: MAX_ITEMS,
            maxItemsSize: this._options.sizes.maxFlowInputSize,
            itemsToRemove: ['pipeline.flowInput', 'userPipeline.flowInput', 'pipeline.flowInputMetadata']
        });
        return { experimentName, jobs };
    }

    async getJobs({ experimentName, pipelineName, pipelineType, pipelineStatus, algorithmName, datesRange, cursor, pageNum, sort, limit = MAX_ITEMS }) {
        const query = {
            experimentName,
            pipelineName,
            pipelineType,
            pipelineStatus,
            algorithmName,
            datesRange
        };
        const jobs = await this._db.jobs.searchApi({
            query,
            cursor,
            pageNum,
            sort,
            fields: {},
            limit,
            // limit: MAX_ITEMS,
            maxItemsSize: this._options.sizes.maxFlowInputSize,
            itemsToRemove: ['pipeline.flowInput', 'userPipeline.flowInput', 'pipeline.flowInputMetadata']
        });

        return jobs;
    }

    async jobSCountByQuery({ experimentName, pipelineName, pipelineType, pipelineStatus, algorithmName, datesRange }) {
        const query = {
            experimentName,
            pipelineName,
            pipelineType,
            pipelineStatus,
            algorithmName,
            datesRange
        };

        const jobsCount = await this._db.jobs.count({ query });
        return jobsCount;
    }

    async pipelinesCount() {
        const count = await this._db.pipelines.count();
        return count;
    }

    async algorithmsCount() {
        const count = await this._db.algorithms.count();
        return count;
    }

    async _getStoredPipelines() {
        return this._db.pipelines.fetchAll({ sort: { modified: 'desc' }, limit: MAX_ITEMS });
    }

    async getFlowInputByJobId(jobId) {
        const pipeline = await this._db.jobs.fetchPipeline({ jobId });
        return pipeline?.flowInput;
    }

    async _getDiscoveryType(type) {
        return this._client.discovery.list({ serviceName: type });
    }

    async _getDiscovery() {
        const discovery = Object.create(null);
        discovery.worker = await this._getDiscoveryType('worker');
        discovery.taskExecutor = await this._getDiscoveryType('task-executor');
        discovery.pipelineDriver = await this._getDiscoveryType('pipeline-driver');
        return discovery;
    }

    async _getAlgorithms() {
        return this._db.algorithms.fetchAll({ sort: { modified: 'desc' }, limit: MAX_ITEMS });
    }

    async _getExperiments() {
        return this._db.experiments.fetchAll({ sort: { created: 'desc' }, limit: MAX_ITEMS });
    }

    async _getDataSources() {
        return this._db.dataSources.listDataSources();
    }

    async _getAlgorithmBuilds() {
        return this._db.algorithms.builds.fetchAll({ sort: { startTime: 'desc' }, limit: MAX_ITEMS });
    }

    async _getAlgorithmBuildsByAlgorithmName(_algorithmName) {
        return this._db.algorithms.builds.search({ algorithmName: _algorithmName, sort: { startTime: 'desc' }, limit: MAX_ITEMS });
    }

    async _getBoards() {
        return this._db.tensorboards.fetchAll({ sort: { startTime: 'desc' }, limit: MAX_ITEMS });
    }
}

module.exports = new DatabaseQuerier();
