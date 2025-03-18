/* eslint-disable no-plusplus */
/* eslint-disable default-case */
const { GraphQLError } = require('graphql');
const { pipelineStatuses, keycloakRoles } = require('@hkube/consts');
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
        if (job.graph?.nodes) {
            job.graph.nodes = job.graph.nodes.map((node) => {
                if (node.input) {
                    // eslint-disable-next-line no-param-reassign
                    node.input = node.input.map(itemInput => {
                        if (!itemInput.path) {
                            return { value: itemInput };
                        }

                        return itemInput;
                    });
                }
                return node;
            });
        }
        return { ...job, key: job.jobId, results: result };
    }

    async queryAlgorithms() {
        return stateManager.getAlgorithms();
    }

    async queryAlgorithmsByName(name) {
        return stateManager.getAlgorithm({ name });
    }

    async queryAlgorithmsByVersion(name, version) {
        return stateManager.getVersion({ name, version });
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
        let builds = [];

        if (algorithmName) {
            builds = await dbQueires._getAlgorithmBuildsByAlgorithmName(algorithmName);
        }
        else {
            builds = await dbQueires._getAlgorithmBuilds();
        }

        return builds;
    }

    async queryLogs(query) {
        const { taskId, podName, source, nodeKind, logMode, pageNum, sort, limit, searchWord, taskTime, containerNames } = query;
        const logs = await logsQueries.getLogs({ taskId, podName, source, nodeKind, logMode, pageNum, sort, limit, searchWord, taskTime, containerNames });
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

    _withAuth(resolver, requiredRoles) {
        return async (parent, args, context, info) => {
            if (!context.checkPermission(requiredRoles)) {
                throw new GraphQLError('Forbidden: You do not have access to this resource', {
                    extenstions: {
                        code: 'FORBIDDEN',
                        http: {
                            status: 401
                        }
                    },
                });
            }
            return resolver(parent, args, context, info);
        };
    }

    _getQueryResolvers() {
        return {
            jobsAggregated: this._withAuth(async (parent, args, context) => {
                // eslint-disable-next-line no-param-reassign
                args.pipelineStatus = args.pipelineStatus || { $not: { $in: [pipelineStatuses.PENDING] } };
                context.args = { ...args };
                const jobs = await this.queryJobs({ ...args });
                return { jobs: jobs.jobs, cursor: jobs.cursor };
            }, [keycloakRoles.API_VIEW]),

            algorithms: this._withAuth(() => (
                { list: this.queryAlgorithms() }
            ), [keycloakRoles.API_VIEW]),

            experiments: this._withAuth(() => {
                this.queryExperiments();
            }, [keycloakRoles.API_VIEW]),

            algorithmsByName: this._withAuth((parent, args) => {
                return this.queryAlgorithmsByName(args.name);
            }, [keycloakRoles.API_VIEW]),

            algorithmsByVersion: this._withAuth((parent, args) => {
                return this.queryAlgorithmsByVersion(args.name, args.version);
            }, [keycloakRoles.API_VIEW]),

            nodeStatistics: this._withAuth(async () => {
                const stats = await statisticsQuerier.getStatisticsResults();
                return stats;
            }, [keycloakRoles.API_VIEW]),

            diskSpace: this._withAuth(async () => {
                const stats = await statisticsQuerier.getDiskUsage();
                return stats;
            }, [keycloakRoles.API_VIEW]),

            jobsByExperimentName: this._withAuth((parent, args) => {
                return this.quesearchJobs(args.experimentName);
            }, [keycloakRoles.API_VIEW]),

            pipelines: this._withAuth(async () => {
                const list = await this.queryPipelines();
                return { list };
            }, [keycloakRoles.API_VIEW]),

            algorithmBuilds: this._withAuth((parent, args) => {
                return this.queryAlgorithmBuilds(args.algorithmName);
            }, [keycloakRoles.API_VIEW]),

            pipelineStats: this._withAuth(() => {
                return this.queryPipelinesStats();
            }, [keycloakRoles.API_VIEW]),

            job: this._withAuth((parent, args) => {
                return this.queryJob(args.id);
            }, [keycloakRoles.API_VIEW]),

            dataSources: this._withAuth(() => (
                { list: this.getDataSources() }
            ), [keycloakRoles.API_VIEW]),

            dataSource: this._withAuth((parent, args) => {
                return this.getDataSource(args);
            }, [keycloakRoles.API_VIEW]),

            DataSourceVersions: this._withAuth((parent, args) => {
                return this.queryDataSourceVersions(args);
            }, [keycloakRoles.API_VIEW]),

            DataSourceSnapanshots: this._withAuth((parent, args) => {
                return this.queryDataSourceSnapshots(args);
            }, [keycloakRoles.API_VIEW]),

            DataSourcePreviewQuery: this._withAuth((parent, args) => {
                return this.queryDataSourcePreviewQuery(args);
            }, [keycloakRoles.API_VIEW]),

            discovery: this._withAuth(() => {
                return this.getDiscovery();
            }, [keycloakRoles.API_VIEW]),

            logsByQuery: this._withAuth((parent, args) => {
                return this.queryLogs({ ...args });
            }, [keycloakRoles.API_VIEW]),

            errorLogs: this._withAuth(async () => {
                const res = await errorLogsQuerier.getLogs();
                return res;
            }, [keycloakRoles.API_VIEW]),

            preferedList: this._withAuth((parent, args) => {
                return preferedQuerier.getPreferedList(args);
            }, [keycloakRoles.API_VIEW]),

            managedList: this._withAuth((parent, args) => {
                return preferedQuerier.getManagedList(args);
            }, [keycloakRoles.API_VIEW]),

            aggregatedTagsPrefered: this._withAuth((parent, args) => {
                return preferedQuerier.getAggregatedPreferedByTags(args);
            }, [keycloakRoles.API_VIEW]),

            aggregatedPipelinePrefered: this._withAuth((parent, args) => {
                return preferedQuerier.getAggregatedPreferedByPipeline(args);
            }, [keycloakRoles.API_VIEW]),

            aggregatedTagsManaged: this._withAuth((parent, args) => {
                return preferedQuerier.getAggregatedManagedByTags(args);
            }, [keycloakRoles.API_VIEW]),

            aggregatedPipelineManaged: this._withAuth((parent, args) => {
                return preferedQuerier.getAggregatedManagedByPipeline(args);
            }, [keycloakRoles.API_VIEW]),

            queueCount: this._withAuth(() => {
                return preferedQuerier.getQueueCount();
            }, [keycloakRoles.API_VIEW]),
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
