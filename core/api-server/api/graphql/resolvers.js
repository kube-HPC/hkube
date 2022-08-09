/* eslint-disable no-plusplus */
/* eslint-disable default-case */
const stateManager = require('../../lib/state/state-manager');
const dbQueires = require('./queries/database-querier');
const preferedQuerier = require('./queries/prefered-querier');
const dataSourceQuerier = require('./queries/dataSource-querier');
const statisticsQuerier = require('./queries/statistics-querier');
const errorLogsQuerier = require('./queries/error-logs-querier');
const logsQueries = require('../task-logs/logs');
class GraphqlResolvers {
    async queryJobs(query) {
        const jobs = await dbQueires.getJobs(query || {});
        return {
            jobs: jobs.hits.map(job => ({ ...job, key: job.jobId, results: job.result })),
            cursor: jobs.cursor

        };
    }

    async queryJob(jobId) {
        const { result, ...job } = await stateManager.getJob({ jobId });
        return { ...job, key: job.jobId, results: result };
    }

    async queryAlgorithms() {
        return stateManager.getAlgorithms();
    }

    async queryAlgorithmsByName(name) {
        return stateManager.getAlgorithm({ name });
    }

    async queryExperiments() {
        return dbQueires._getExperiments();
    }

    async quesearchJobs(query) {
        return stateManager.getJobs().filter(job => {
            return job.name.includes(query) || job.pipeline.name.includes(query) || job.pipeline.experimentName.includes(query);
        });
    }

    async queryPipelines() {
        const pipelines = await dbQueires._getStoredPipelines();
        return pipelines;
    }

    async queryPipelinesStats() {
        return dbQueires.getPipelinesStats();
    }

    async queryAlgorithmBuilds(algorithmName) {
        const builds = await dbQueires._getAlgorithmBuilds(algorithmName);
        return builds;
    }

    async queryLogs(query) {
        const { taskId, podName, source, nodeKind, logMode, pageNum, sort, limit } = query;
        const logs = await logsQueries.getLogs({ taskId, podName, source, nodeKind, logMode, pageNum, sort, limit });
        return logs;
    }

    async quertDataSource(query) {
        const dataSource = await dataSourceQuerier.getDataSource(query);
        return dataSource;
    }

    async queryDataSourceVersions(query) {
        const dataSource = await dataSourceQuerier.getDataSourceVersions(query);
        return dataSource;
    }

    async queryDataSourceSnapshots(query) {
        const dataSource = await dataSourceQuerier.getDataSourceSnapshots(query);
        return dataSource;
    }

    async queryDataSourcePreviewQuery(query) {
        const dataSource = await dataSourceQuerier.postDataSourcePreviewQuery(query);
        return dataSource;
    }

    async getDiscovery() {
        return dbQueires.lastResults?.discovery;
    }

    async getDataSources() {
        const dataSources = await dataSourceQuerier.getDataSourcesList();
        return dataSources;
    }

    async getDataSource(query) {
        const ds = await dataSourceQuerier.getDataSource(query);
        return ds;
    }

    _getQueryResolvers() {
        return {
            jobsAggregated: async (parent, args, context) => {
                context.args = { ...args };
                const jobs = await this.queryJobs({ ...args });
                return { jobs: jobs.jobs, cursor: jobs.cursor };
            },
            algorithms: () => ({ list: this.queryAlgorithms() }),
            experiments: () => this.queryExperiments(),
            algorithmsByName: (parent, args) => {
                return this.queryAlgorithmsByName(args.name);
            },
            nodeStatistics: async () => {
                const stats = await statisticsQuerier.getStatisticsResults();
                return stats;
            },
            diskSpace: async () => {
                const stats = await statisticsQuerier.getDiskUsage();
                return stats;
            },
            jobsByExperimentName: (parent, args) => {
                return this.quesearchJobs(args.experimentName);
            },
            pipelines: async () => {
                const list = await this.queryPipelines();
                return { list };
            },

            algorithmBuilds: (parent, args) => {
                return this.queryAlgorithmBuilds(args.algorithmName);
            },
            pipelineStats: () => {
                return this.queryPipelinesStats();
            },
            job: (parent, args) => {
                return this.queryJob(args.id);
            },
            dataSources: () => ({ list: this.getDataSources() }),
            dataSource: (parent, args) => {
                return this.getDataSource(args);
            },
            DataSourceVersions: (parent, args) => {
                return this.queryDataSourceVersions(args);
            },
            DataSourceSnapanshots: (parent, args) => {
                return this.queryDataSourceSnapshots(args);
            },
            DataSourcePreviewQuery: (parent, args) => {
                return this.queryDataSourcePreviewQuery(args);
            },
            discovery: () => {
                return this.getDiscovery();
            },
            logsByQuery: (parent, args) => {
                return this.queryLogs({ ...args });
            },
            errorLogs: async () => {
                const res = await errorLogsQuerier.getLogs();
                return res;
            },
            preferedList: (parent, args) => {
                return preferedQuerier.getPreferedList(args);
            },
            managedList: (parent, args) => {
                return preferedQuerier.getManagedList(args);
            },
            aggregatedTagsPrefered: (parent, args) => {
                return preferedQuerier.getAggregatedPreferedByTags(args);
            },
            aggregatedPipelinePrefered: (parent, args) => {
                return preferedQuerier.getAggregatedPreferedByPipeline(args);
            },
            aggregatedTagsManaged: (parent, args) => {
                return preferedQuerier.getAggregatedManagedByTags(args);
            },
            aggregatedPipelineManaged: (parent, args) => {
                return preferedQuerier.getAggregatedManagedByPipeline(args);
            },
            queueCount: () => {
                return preferedQuerier.getQueueCount();
            },
        };
    }

    _getTypesResolvers() {
        return {
            Algorithm: {
                async buildStats(parent) {
                    const builds = await dbQueires._getAlgorithmBuildsByAlgorithmName(parent.name) || [];
                    const buildStatsObject = {
                        total: 0,
                        pending: 0,
                        creating: 0,
                        active: 0,
                        completed: 0,
                        failed: 0,
                        stopped: 0
                    };
                    builds.forEach(build => {
                        buildStatsObject.total++;
                        buildStatsObject[build.status]++;
                    });
                    return buildStatsObject;
                }
            },
            AggregatedJobs: {
                async jobsCount(parent, args, context) {
                    const count = await dbQueires.jobSCountByQuery(context && context.args ? context.args : {}) || 0;
                    return count;
                }
            },
            AutogeneratedPipelines: {
                async pipelinesCount() {
                    const count = await dbQueires.pipelinesCount() || 0;
                    return count;
                }
            },
            AutogeneratedAlgorithms: {
                async algorithmsCount() {
                    const count = await dbQueires.algorithmsCount() || 0;
                    return count;
                }
            },
            AutogeneratedDataSources: {
                async dataSourcesCount() {
                    const count = await dataSourceQuerier.getDataSourcesCount();
                    return count;
                }
            }

        };
    }

    getResolvers() {
        return {
            ...this._getTypesResolvers(),
            Query: this._getQueryResolvers(),
        };
    }
}
module.exports = new GraphqlResolvers();
