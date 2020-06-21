const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const executionService = require('./execution');
const { ResourceNotFoundError, ResourceExistsError, } = require('../errors');

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
