const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, } = require('../errors');

class PipelineStore {
    /**
     * update existing pipeline
     * */
    async updatePipeline(options) {
        validator.validateUpdatePipeline(options);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        await validator.validateAlgorithmName(options);
        await storageManager.putStore({ type: 'pipeline', name: options.name, data: options });
        await stateManager.setPipeline(options);
        return options;
    }

    /**
     * delete existing pipeline
     * */
    async deletePipeline(options) {
        validator.validateName(options);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return stateManager.deletePipeline(options);
    }

    /**
     * get existing pipeline
     * */
    async getPipeline(options) {
        validator.validateName(options);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return pipeline;
    }

    /**
     * get all pipelines
     */
    async getPipelines() {
        return stateManager.getPipelines();
    }

    /**
     * add new pipeline
     * */
    async insertPipeline(options) {
        validator.validateUpdatePipeline(options);
        const pipe = await stateManager.getPipeline(options);
        if (pipe) {
            throw new ResourceExistsError('pipeline', options.name);
        }
        await validator.validateAlgorithmName(options);
        await storageManager.putStore({ type: 'pipeline', name: options.name, data: options });
        await stateManager.setPipeline(options);
        return options;
    }
}

module.exports = new PipelineStore();
