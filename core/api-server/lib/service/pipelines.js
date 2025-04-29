const isEqual = require('lodash.isequal');
const graphlib = require('graphlib');
const { pipelineTypes } = require('@hkube/consts');
const { NodesMap } = require('@hkube/dag');
const validator = require('../validation/api-validator');
const executionService = require('./execution');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, InvalidDataError } = require('../errors');
const pipelineCreator = require('./pipeline-creator');
const graphBuilder = require('../utils/graph-builder');
const versionsService = require('./pipeline-versions');

class PipelineService {
    async updatePipeline(options, userName) {
        validator.pipelines.validateUpdatePipeline(options);
        await validator.algorithms.validateAlgorithmExists(options);
        validator.gateways.validateGatewayNodes(options.nodes);
        const oldPipeLine = await this.getPipeline(options);
        const newPipeline = {
            modified: Date.now(),
            ...options,
        };
        const hasDiff = this._comparePipelines(newPipeline, oldPipeLine);
        const newVersion = await this._versioning(hasDiff, newPipeline, userName);
        if (newVersion) {
            newPipeline.version = newVersion;
        }

        if (!oldPipeLine.auditTrail) {
            newPipeline.auditTrail = [];
        }
        const auditEntry = {
            user: userName,
            timestamp: newPipeline.modified,
            version: newPipeline.version
        };
        newPipeline.auditTrail = [
            auditEntry,
            ...oldPipeLine.auditTrail || []
        ];

        await stateManager.replacePipeline(newPipeline);
        return newPipeline;
    }

    async deletePipeline(options) {
        const { name, keepOldVersions } = options;
        validator.pipelines.validatePipelineName(name);
        await this.getPipeline(options);
        let summary = `pipeline ${name} successfully deleted from store`;
        const result = await this._stopAllRunningPipelines(options);
        if (result.length > 0) {
            const stopped = result.filter(r => r.status === 'fulfilled');
            summary += `, stopped related running pipelines ${stopped.length}/${result.length}`;
        }
        await stateManager.deletePipeline({ name, keepOldVersions });
        return summary;
    }

    async _stopAllRunningPipelines(options) {
        const pipelines = await stateManager.searchJobs({
            pipelineName: options.name,
            pipelineType: pipelineTypes.STORED,
            hasResult: false,
            fields: { jobId: true },
        });
        return Promise.allSettled(pipelines.map(p => executionService.stopJob({ jobId: p.jobId, reason: 'pipeline has been deleted' })));
    }

    async getPipeline(options) {
        validator.pipelines.validatePipelineName(options.name);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return pipeline;
    }

    async getGraphByStreamingFlow(payload) {
        let extendedPipeline = payload.pipeline;

        // eslint-disable-next-line no-useless-catch
        try {
            extendedPipeline = await pipelineCreator.buildStreamingFlowGraph(payload);

            const modifiedEdges = extendedPipeline.edges.map((obj) => ({
                from: obj.source,
                to: obj.target,
            }));

            extendedPipeline.edges = modifiedEdges;
            return extendedPipeline;
        }
        catch (error) {
            throw error;
        }
    }

    async getPipelineGraph(pipeline) {
        const { flowInputMetadata, flowInput, ...restPipeline } = pipeline;
        const extendedPipeline = await pipelineCreator.buildPipelineOfPipelines(restPipeline);
        const nodes = new NodesMap(extendedPipeline, { validateNodesRelations: true });
        const graph = nodes.getJSONGraph();
        return graphBuilder._filterData(graph);
    }

    async getGraphByKindOrName(payload) {
        let pipeline = null;
        let response = null;
        let keyFlow = null;
        let isBuildAllFlows = false;
        if (payload.name) {
            validator.pipelines.validatePipelineName(payload.name);
            pipeline = await stateManager.getPipeline(payload.name);
            if (!pipeline) {
                throw new ResourceNotFoundError('pipeline', payload.name);
            }
        }
        else {
            pipeline = payload.pipeline;
            keyFlow = payload.keyFlow;
            isBuildAllFlows = payload.isBuildAllFlows;
        }

        if (pipeline.kind === 'stream') {
            response = await this.getGraphByStreamingFlow({ pipeline, keyFlow, isBuildAllFlows });
        }
        else {
            response = await this.getPipelineGraph(pipeline);
        }

        return response;
    }

    async getPipelines() {
        return stateManager.getPipelines();
    }

    async getPipelinesTriggersTree(options) {
        const { name } = options;
        const graph = new graphlib.Graph();
        const pipelines = await stateManager.searchPipelines({
            hasPipelinesTriggers: true
        });
        if (pipelines.length === 0) {
            throw new InvalidDataError('unable to find any pipeline with triggers');
        }
        pipelines.forEach(p => {
            p.triggers.pipelines.forEach(pr => {
                graph.setEdge(pr, p.name);
            });
        });
        if (!graphlib.alg.isAcyclic(graph)) {
            throw new InvalidDataError('the pipelines triggers is cyclic');
        }
        graph.nodes().forEach(n => graph.setNode(n, { name: n, children: [] }));
        graph.sources().forEach(n => this._traverse(graph, n));

        if (name) {
            const node = graph.nodes().find(n => n === name);
            if (!node) {
                throw new ResourceNotFoundError('triggers tree', name);
            }
            return [graph.node(node)];
        }
        return graph.sources().map(n => graph.node(n));
    }

    _traverse(graph, nodeName) {
        const successors = graph.successors(nodeName);
        const predecessors = graph.predecessors(nodeName);
        const node = graph.node(nodeName);

        predecessors.forEach((p) => {
            const parent = graph.node(p);
            const hasChild = parent.children.find(n => n.name === node.name);
            !hasChild && parent.children.push(node);
        });
        successors.forEach((s) => {
            this._traverse(graph, s);
        });
    }

    async insertPipeline(options, failOnError = true, allowOverwrite = false, userName) {
        try {
            validator.pipelines.validateUpdatePipeline(options);
            await validator.algorithms.validateAlgorithmExists(options);
            validator.gateways.validateGatewayNodes(options.nodes);
        }
        catch (error) {
            if (error.code === 409) {
                if (failOnError) {
                    throw new ResourceExistsError('pipeline', options.name);
                }
                return {
                    error: {
                        code: 409,
                        message: error.message,
                    },
                };
            }
            if (error.status === 404) {
                const errorMessage = error.message;
                if (failOnError) {
                    const notFoundError = new Error(errorMessage);
                    notFoundError.status = 404;
                    throw notFoundError;
                }
                return {
                    error: {
                        code: 404,
                        message: error.message,
                    },
                };
            }
            if (failOnError) {
                throw new InvalidDataError(error.message);
            }
            return {
                error: {
                    name: options.name,
                    code: 400,
                    message: error.message,
                },
            };
        }
        const pipeline = await stateManager.getPipeline(options);
        if (pipeline) {
            if (allowOverwrite === 'true') {
                try {
                    const updatedPipeline = await this.updatePipeline(options, userName);
                    return updatedPipeline;
                }
                catch (error) {
                    return {
                        error: {
                            name: options.name,
                            code: 400,
                            message: `Error updating ${options.name} ${error.message}`
                        }
                    };
                }
            }
            if (failOnError) {
                throw new ResourceExistsError('pipeline', options.name);
            }
            return {
                error: {
                    code: 409,
                    message: `pipeline ${options.name} already exists`,
                },
            };
        }
        const newPipeline = {
            modified: Date.now(),
            ...options,
        };
        const version = await this._versioning(true, newPipeline, userName);
        newPipeline.version = version;
        const auditEntry = {
            user: userName,
            timestamp: newPipeline.modified,
            version: newPipeline.version
        };
        newPipeline.auditTrail = [auditEntry];
        await stateManager.insertPipeline(newPipeline);
        return newPipeline;
    }

    _comparePipelines(oldPipeline, newPipeline) {
        if (!oldPipeline) {
            return true;
        }
        return !isEqual(oldPipeline, newPipeline);
    }

    async _versioning(hasDiff, pipeline, userName) {
        let version;
        if (hasDiff) {
            version = await versionsService.createVersion(pipeline, userName);
        }
        return version;
    }
}
module.exports = new PipelineService();
