const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class Readme {
    async getPipeline(options) {
        const { name } = options;
        validator.pipelines.validatePipelineName(options.name);
        const pipeline = await stateManager.pipelines.get(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        let result;
        let error;
        try {
            result = await storageManager.hkubeStore.get({ type: 'readme/pipeline', name });
        }
        catch (e) {
            error = e.message;
        }
        if (error) {
            throw new ResourceNotFoundError('readme', options.name, error);
        }
        return result;
    }

    async insertPipeline(options) {
        return this._updatePipelineReadme(options);
    }

    async updatePipeline(options) {
        return this._updatePipelineReadme(options);
    }

    async _updatePipelineReadme(options) {
        const { name, data } = options;
        validator.pipelines.validatePipelineName(options.name);
        const pipeline = await stateManager.pipelines.get(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        const result = await storageManager.hkubeStore.put({ type: 'readme/pipeline', name, data: { name, readme: data } });
        return result;
    }

    async deletePipeline(options) {
        const { name } = options;
        validator.pipelines.validatePipelineName(name);
        const pipeline = await stateManager.pipelines.get(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        const result = await storageManager.hkubeStore.delete({ type: 'readme/pipeline', name });
        return result;
    }

    async getAlgorithm(options) {
        const { name } = options;
        validator.jobs.validateName(options);
        const algorithm = await stateManager.algorithms.store.get(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        let result;
        let error;
        try {
            result = await storageManager.hkubeStore.get({ type: 'readme/algorithms', name });
        }
        catch (e) {
            error = e.message;
        }
        if (error) {
            throw new ResourceNotFoundError('readme', options.name, error);
        }
        return result;
    }

    async insertAlgorithm(options) {
        return this._updateAlgorithmReadme(options);
    }

    async updateAlgorithm(options) {
        return this._updateAlgorithmReadme(options);
    }

    async _updateAlgorithmReadme(options) {
        const { name, data } = options;
        validator.algorithms.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.algorithms.store.get(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const result = await storageManager.hkubeStore.put({ type: 'readme/algorithms', name, data: { name, readme: data } });
        return result;
    }

    async deleteAlgorithm(options) {
        const { name } = options;
        validator.jobs.validateName(options);
        const algorithm = await stateManager.algorithms.store.get(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const result = await storageManager.hkubeStore.delete({ type: 'readme/algorithms', name });
        return result;
    }
}

module.exports = new Readme();
