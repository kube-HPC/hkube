

const storageManager = require('@hkube/storage-manager');
const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class Readme {
    async getPipeline(options) {
        const { name } = options;
        validator.validatePipelineName(options.name);
        const pipeline = await stateManager.getPipeline(options);
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
        const { name, data } = options;
        validator.validatePipelineName(options.name);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        const result = await storageManager.hkubeStore.put({ type: 'readme/pipeline', name, data: { readme: data } });
        return result;
    }

    async updatePipeline(options) {
        const { name, data } = options;
        validator.validatePipelineName(options.name);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        const result = await storageManager.hkubeStore.put({ type: 'readme/pipeline', name, data: { readme: data } });
        return result;
    }

    async deletePipeline(options) {
        const { name } = options;
        validator.validatePipelineName(name);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        const result = await storageManager.hkubeStore.delete({ type: 'readme/pipeline', name });
        return result;
    }

    async getAlgorithm(options) {
        const { name } = options;
        validator.validateName(options);
        const algorithm = await stateManager.getAlgorithm(options);
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
        const { name, data } = options;
        validator.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const result = await storageManager.hkubeStore.put({ type: 'readme/algorithms', name, data: { readme: data } });
        return result;
    }

    async updateAlgorithm(options) {
        const { name, data } = options;
        validator.validateUpdateAlgorithm(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const result = await storageManager.hkubeStore.put({ type: 'readme/algorithms', name, data: { readme: data } });
        return result;
    }

    async deleteAlgorithm(options) {
        const { name } = options;
        validator.validateName(options);
        const algorithm = await stateManager.getAlgorithm(options);
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', options.name);
        }
        const result = await storageManager.hkubeStore.delete({ type: 'readme/algorithms', name });
        return result;
    }
}

module.exports = new Readme();
