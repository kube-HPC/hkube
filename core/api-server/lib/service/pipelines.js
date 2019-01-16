const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, } = require('../errors');

class PipelineStore {
    async updatePipeline(options) {
        validator.validateUpdatePipeline(options);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        await validator.validateAlgorithmName(options);
        await storageManager.hkubeStore.put({ type: 'pipeline', name: options.name, data: options });
        await stateManager.setPipeline(options);
        return options;
    }

    async deletePipeline(options) {
        validator.validatePipelineName(options.name);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return stateManager.deletePipeline(options);
    }

    async getPipeline(options) {
        validator.validatePipelineName(options.name);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return pipeline;
    }

    async getPipelines() {
        return stateManager.getPipelines();
    }

    async insertPipeline(options) {
        validator.validateUpdatePipeline(options);
        await validator.validateAlgorithmName(options);
        await storageManager.hkubeStore.put({ type: 'pipeline', name: options.name, data: options });

        const pipe = await stateManager.getPipeline(options);
        if (pipe) {
            throw new ResourceExistsError('pipeline', options.name);
        }
        await stateManager.setPipeline(options);
        return options;
    }
}

module.exports = new PipelineStore();
