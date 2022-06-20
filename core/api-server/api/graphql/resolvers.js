/* eslint-disable no-plusplus */
/* eslint-disable default-case */
const { GraphQLScalarType } = require('graphql');
const { withFilter } = require('graphql-subscriptions');
const stateManager = require('../../lib/state/state-manager');
const dbQueires = require('./database-querier');
const preferedQuerier = require('./prefered-querier');
const dataSourceQuerier = require('./dataSource-querier');
const statisticsQuerier = require('./statistics-querier');
const logsQueries = require('../task-logs/logs');
class GraphqlResolvers {
    constructor() {
        // this.ObjectScalarType = new GraphQLScalarType({
        //     name: 'Object',
        //     description: 'Arbitrary object',
        //     parseValue: (value) => {
        //         return typeof value === 'object' ? value
        //             : typeof value === 'string' ? JSON.parse(value)
        //                 : null;
        //     },
        //     serialize: (value) => {
        //         return typeof value === 'object' ? value
        //             : typeof value === 'string' ? JSON.parse(value)
        //                 : null;
        //     },
        //     parseLiteral: (ast) => {
        //         switch (ast.kind) {
        //             case Kind.STRING: return JSON.parse(ast.value);
        //             case Kind.OBJECT: throw new Error('Not sure what to do with OBJECT for ObjectScalarType');
        //             default: return null;
        //         }
        //     }
        // });
    }

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

    async quesearchJobs(query) {
        return stateManager.getJobs().filter(job => {
            return job.name.includes(query) || job.pipeline.name.includes(query) || job.pipeline.experimentName.includes(query);
        });
    }

    async queryPipelines() {
        const pipelines = await dbQueires._getStoredPipelines();
        return pipelines;
    }

    async queryPipelinesStats(pipelineName) {
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
        // return await dbQueires._getDiscovery();
        return dbQueires.lastResults?.discovery;
    }
    async getDataSources() {
        // const dataSources = await dbQueires._getDataSources();
        const dataSources = await dataSourceQuerier.getDataSourcesList();
        return dataSources;
    }

    async getDataSource(query) {
        const ds = await dataSourceQuerier.getDataSource(query);
        return ds;
    }

    _getQueryResolvers() {
        return {
            jobsAggregated: async (parent, args, context, info) => {
                const jobs = await this.queryJobs({ ...args });
                return { jobs: jobs.jobs, cursor: jobs.cursor };
            },
            algorithms: () => this.queryAlgorithms(),
            algorithmsByName: (parent, args, context, info) => {
                return this.queryAlgorithmsByName(args.name);
            },
            nodeStatistics: async () => {
                const stats = await statisticsQuerier.getStatisticsResults()
                return stats;
            },
            jobsByExperimentName: (parent, args, context, info) => {
                return this.quesearchJobs(args.experimentName);
            },
            pipelines: () => this.queryPipelines(),

            algorithmBuilds: (parent, args, context, info) => {
                return this.queryAlgorithmBuilds(args.algorithmName);
            },
            pipelineStats: (parent, args, context, info) => {
                return this.queryPipelinesStats();
            },
            job: (parent, args, context, info) => {
                return this.queryJob(args.id);
            },
            dataSources: () => this.getDataSources(),
            dataSource: (parent, args, context, info) => {
                return this.getDataSource(args);
            },
            DataSourceVersions: (parent, args, context, info) => {
                return this.queryDataSourceVersions(args);
            },
            DataSourceSnapanshots: (parent, args, context, info) => {
                return this.queryDataSourceSnapshots(args);
            },
            DataSourcePreviewQuery: (parent, args, context, info) => {
                return this.queryDataSourcePreviewQuery(args);
            },
            discovery: (parent, args, context, info) => {
                return this.getDiscovery();
            },
            logsByQuery: (parent, args, context, info) => {
                return this.queryLogs({ ...args });
            },
            preferedList: (parent, args, context, info) => {
                return preferedQuerier.getPreferedList(args);
            },
            managedList: (parent, args, context, info) => {
                return preferedQuerier.getManagedList(args);
            },
            aggregatedTagsPrefered: (parent, args, context, info) => {
                return preferedQuerier.getAggregatedPreferedByTags(args);
            },
            aggregatedPipelinePrefered: (parent, args, context, info) => {
                return preferedQuerier.getAggregatedPreferedByPipeline(args);
            },
            aggregatedTagsManaged: (parent, args, context, info) => {
                return preferedQuerier.getAggregatedManagedByTags(args);
            },
            aggregatedPipelineManaged: (parent, args, context, info) => {
                return preferedQuerier.getAggregatedManagedByPipeline(args);
            }
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
            }

        };
    }

    _getSubscriptionResolvers() {
        return {
            numberIncremented: {
                subscribe: () => {
                    return pubsub.asyncIterator(['NUMBER_INCREMENTED']);
                }
            },
            numberIncrementedOdd: {
                subscribe: withFilter(
                    () => pubsub.asyncIterator('NUMBER_INCREMENTED_ODD'),
                    (payload, variables) => {
                        // Only push an update if the comment is on
                        // the correct repository for this operation
                        console.log(variables);
                        return ((payload.numberIncrementedOdd % variables.number) === 0);
                    },
                )

            }

        };
    }

    getResolvers() {
        return {
            ...this._getTypesResolvers(),
            //    Object: this.ObjectScalarType,
            Query: this._getQueryResolvers(),
            Subscription: this._getSubscriptionResolvers()
        };
    }
}
module.exports = new GraphqlResolvers();

// const resolvers = {
//     Object: ObjectScalarType,
//     Query: {
//         jobs: () => stubs.jobs,
//         algorithms: () => stubs.algorithms,
//         algorithmsByName: (parent, args, context, info) => {
//             return stubs.algorithms.find(algorithm => algorithm.name === args.name);
//         },
//         jobsByExperimentName: (parent, args, context, info) => {
//             return stubs.jobs.filter(job => job.pipeline.experimentName === args.experimentName);
//         },
//         pipelines: () => stubs.pipelines,
//         algorithmBuilds: (algorithmName) => stubs.algorithmBuilds,
//     },
//     Subscription: {
//         numberIncremented: {
//             subscribe: () => {
//                 return pubsub.asyncIterator(["NUMBER_INCREMENTED"])
//             }
//         },
//         numberIncrementedOdd: {
//             subscribe: withFilter(
//                 () => pubsub.asyncIterator('NUMBER_INCREMENTED_ODD'),
//                 (payload, variables) => {
//                     // Only push an update if the comment is on
//                     // the correct repository for this operation
//                     console.log(variables)
//                     return ((payload.numberIncrementedOdd % variables.number) === 0);
//                 },
//             )
//         }
//     },

// };
