const graphlib = require('graphlib');
const { pipelineTypes } = require('@hkube/consts');
const validator = require('../validation/api-validator');
const executionService = require('./execution');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, InvalidDataError } = require('../errors');

class PipelineService {
    async updatePipeline(options) {
        validator.pipelines.validateUpdatePipeline(options);
        await this.getPipeline(options);
        await validator.algorithms.validateAlgorithmExists(options);
        const newPipeline = {
            modified: Date.now(),
            ...options,
        };
        await stateManager.replacePipeline(newPipeline);
        return options;
    }

    async deletePipeline(options) {
        const { name } = options;
        validator.pipelines.validatePipelineName(name);
        await this.getPipeline(options);
        let summary = `pipeline ${name} successfully deleted from store`;
        const result = await this._stopAllRunningPipelines(options);
        if (result.length > 0) {
            const stopped = result.filter(r => r.success);
            summary += `, stopped related running pipelines ${stopped.length}/${result.length}`;
        }
        await stateManager.deletePipeline({ name });
        return summary;
    }

    async _stopAllRunningPipelines(options) {
        const pipelines = await stateManager.searchJobs({
            pipelineName: options.name,
            pipelineType: pipelineTypes.STORED,
            hasResult: false,
            fields: { jobId: true },
        });
        const result = await Promise.all(pipelines.map(p => this._promiseWrapper(() => executionService.stopJob({ jobId: p.jobId, reason: 'pipeline has been deleted' }))));
        return result;
    }

    _promiseWrapper(func) {
        return new Promise((resolve) => {
            func().then(() => resolve({ success: true })).catch(() => resolve({ success: false }));
        });
    }

    async getPipeline(options) {
        validator.pipelines.validatePipelineName(options.name);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return pipeline;
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

    async insertPipeline(options) {
        validator.pipelines.validateUpdatePipeline(options);
        await validator.algorithms.validateAlgorithmExists(options);

        const pipeline = await stateManager.getPipeline(options);
        if (pipeline) {
            throw new ResourceExistsError('pipeline', options.name);
        }
        const newPipeline = {
            modified: Date.now(),
            ...options,
        };
        await stateManager.insertPipeline(newPipeline);
        return options;
    }
}

module.exports = new PipelineService();
