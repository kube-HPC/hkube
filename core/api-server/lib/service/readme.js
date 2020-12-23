const validator = require('../validation/api-validator');
const stateManager = require('../state/state-manager');
const { ResourceNotFoundError } = require('../errors');

class Readme {
    async getPipeline(options) {
        const { name } = options;
        validator.pipelines.validatePipelineName(name);
        const pipeline = await stateManager.getPipelineReadMe({ name });
        if (!pipeline) {
            throw new ResourceNotFoundError('readme', name);
        }
        return { name, readme: pipeline.data };
    }

    async insertPipeline(options) {
        return this._updatePipelineReadme(options);
    }

    async updatePipeline(options) {
        return this._updatePipelineReadme(options);
    }

    async _updatePipelineReadme(options) {
        const { name, data } = options;
        validator.pipelines.validatePipelineName(name);
        const pipeline = await stateManager.getPipeline({ name });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', name);
        }
        await stateManager.updatePipelineReadMe({ name, data });
    }

    async deletePipeline(options) {
        const { name } = options;
        validator.pipelines.validatePipelineName(name);
        const pipeline = await stateManager.getPipelineReadMe(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('readme', name);
        }
        const result = await stateManager.deletePipelineReadMe({ name });
        return result;
    }

    async getAlgorithm(options) {
        const { name } = options;
        validator.algorithms.validateAlgorithmName({ name });
        const algorithm = await stateManager.getAlgorithmReadMe({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('readme', name);
        }
        return { name, readme: algorithm.data };
    }

    async insertAlgorithm(options) {
        return this._updateAlgorithmReadme(options);
    }

    async updateAlgorithm(options) {
        return this._updateAlgorithmReadme(options);
    }

    async _updateAlgorithmReadme(options) {
        const { name, data } = options;
        validator.algorithms.validateAlgorithmName({ name });
        const algorithm = await stateManager.getAlgorithm({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        await stateManager.updateAlgorithmReadMe({ name, data });
    }

    async deleteAlgorithm(options) {
        const { name } = options;
        validator.algorithms.validateAlgorithmName({ name });
        const algorithm = await stateManager.getAlgorithmReadMe({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('readme', name);
        }
        const result = await stateManager.deleteAlgorithmReadMe({ name });
        return result;
    }
}

module.exports = new Readme();
