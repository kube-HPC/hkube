const { GraphQLScalarType } = require('graphql');
const { withFilter } = require('graphql-subscriptions');
const stateManager = require('../../lib/state/state-manager');
const dbQueires = require('./database-querier');
const logsQueries = require('../task-logs/logs');
class GraphqlResolvers {
    constructor() {
        this.ObjectScalarType = new GraphQLScalarType({
            name: 'Object',
            description: 'Arbitrary object',
            parseValue: (value) => {
                return typeof value === 'object' ? value
                    : typeof value === 'string' ? JSON.parse(value)
                        : null;
            },
            serialize: (value) => {
                return typeof value === 'object' ? value
                    : typeof value === 'string' ? JSON.parse(value)
                        : null;
            },
            parseLiteral: (ast) => {
                switch (ast.kind) {
                    case Kind.STRING: return JSON.parse(ast.value);
                    case Kind.OBJECT: throw new Error('Not sure what to do with OBJECT for ObjectScalarType');
                    default: return null;
                }
            }
        });
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
        return dbQueires._getStoredPipelines();
    }

    async queryPipelinesStats(pipelineName) {
        return dbQueires.getPipelinesStats();
    }

    async queryAlgorithmBuilds(algorithmName) {
        return stateManager.getBuilds({ algorithmName });
    }

    async queryLogs(query) {
        const { taskId, podName, source, nodeKind, logMode, pageNum, sort, limit } = query;
        const logs = await logsQueries.getLogs({ taskId, podName, source, nodeKind, logMode, pageNum, sort, limit });
        return logs;
    }

    async getDiscovery() {
        // return await dbQueires._getDiscovery();
        return dbQueires.lastResults?.discovery;
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
            discovery: (parent, args, context, info) => {
                return this.getDiscovery();
            },
            logsByQuery: (parent, args, context, info) => {
                return this.queryLogs({ ...args });
            }
        };
    }

    _getMutationResolvers() {

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
            Object: this.ObjectScalarType,
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
