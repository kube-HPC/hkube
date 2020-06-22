const graphlib = require('graphlib');
const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const executionService = require('./execution');
const { ResourceNotFoundError, ResourceExistsError, InvalidDataError } = require('../errors');

class PipelineStore {
    async updatePipeline(options) {
        validator.validateUpdatePipeline(options);
        const pipeline = await stateManager.pipelines.get(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        await validator.validateAlgorithmExists(options);
        await storageManager.hkubeStore.put({ type: 'pipeline', name: options.name, data: options });
        await stateManager.pipelines.set(options);
        return options;
    }

    async deletePipeline(options) {
        validator.validatePipelineName(options.name);
        const pipeline = await stateManager.pipelines.get(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        let summary = `pipline ${options.name} successfully deleted from store`;
        const result = await this._stopAllRunningPipelines(options);
        if (result.length > 0) {
            const stopeed = result.filter(r => r.success);
            summary += `, stopped related running pipelines ${stopeed.length}/${result.length}`;
        }
        await this.deletePipelineFromStore(options);
        return summary;
    }

    async _stopAllRunningPipelines(options) {
        const limit = 1000;
        const pipelines = await stateManager.executions.running.list({ limit }, (p) => p.name === options.name);
        const result = await Promise.all(pipelines.map(p => this._promiseWrapper(() => executionService.stopJob(p))));
        return result;
    }

    async deletePipelineFromStore(options) {
        await storageManager.hkubeStore.delete({ type: 'pipeline', name: options.name });
        await storageManager.hkubeStore.delete({ type: 'readme/pipeline', name: options.name });
        return stateManager.pipelines.delete(options);
    }

    _promiseWrapper(func) {
        return new Promise((resolve) => {
            func().then(() => resolve({ success: true })).catch(() => resolve({ success: false }));
        });
    }

    async getPipeline(options) {
        validator.validatePipelineName(options.name);
        const pipeline = await stateManager.pipelines.get(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return pipeline;
    }

    async getPipelines() {
        return stateManager.pipelines.list();
    }

    async getPipelinesTriggersTree(options) {
        const { name } = options;
        const graph = new graphlib.Graph();
        const pipelines = await stateManager.pipelines.list({ name }, (p) => p.triggers && p.triggers.pipelines && p.triggers.pipelines.length);
        if (pipelines.length === 0) {
            throw new ResourceNotFoundError('triggers tree', name)
        }
        pipelines.forEach(pl => {
            const parents = pl.triggers.pipelines.map(t => t);
            parents.forEach(pr => {
                graph.setEdge(pr, pl.name);
            });
        });
        if (!graphlib.alg.isAcyclic(graph)) {
            throw new InvalidDataError('the pipelines triggers is cyclic');
        }
        graph.nodes().forEach(n => graph.setNode(n, { name: n, children: [] }));
        graph.sources().forEach(n => this._traverse(graph, n));
        const nodes = graph.sources();
        return nodes.map(n => graph.node(n));
    }

    _traverse(graph, nodeName) {
        const successors = graph.successors(nodeName);
        const parents = graph.edges().filter(l => l.w === nodeName).map(l => graph.node(l.v));
        const node = graph.node(nodeName);

        parents.forEach((p) => {
            const hasChild = p.children.find(n => n.name === node.name);
            !hasChild && p.children.push(node);
        });
        successors.forEach((s) => {
            this._traverse(graph, s);
        });
    }

    async insertPipeline(options) {
        validator.validateUpdatePipeline(options);
        await validator.validateAlgorithmExists(options);
        await storageManager.hkubeStore.put({ type: 'pipeline', name: options.name, data: options });

        const pipe = await stateManager.pipelines.get(options);
        if (pipe) {
            throw new ResourceExistsError('pipeline', options.name);
        }
        await stateManager.pipelines.set(options);
        return options;
    }
}

module.exports = new PipelineStore();
