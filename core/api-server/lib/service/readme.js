const validator = require('../validation/api-validator');
const db = require('../db');
const { ResourceNotFoundError } = require('../errors');

class Readme {
    async getPipeline(options) {
        const { name } = options;
        validator.pipelines.validatePipelineName(name);
        const pipeline = await db.pipelines.readme.fetch({ name });
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
        const pipeline = await db.pipelines.fetch({ name });
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', name);
        }
        await db.pipelines.readme.update({ name, data });
    }

    async deletePipeline(options) {
        const { name } = options;
        validator.pipelines.validatePipelineName(name);
        const pipeline = await db.pipelines.readme.fetch(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('readme', name);
        }
        const result = await db.pipelines.readme.delete({ name });
        return result;
    }

    async getAlgorithm(options) {
        const { name } = options;
        validator.algorithms.validateAlgorithmName({ name });
        const algorithm = await db.algorithms.readme.fetch({ name });
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
        const algorithm = await db.algorithms.fetch({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('algorithm', name);
        }
        await db.algorithms.readme.update({ name, data });
    }

    async deleteAlgorithm(options) {
        const { name } = options;
        validator.algorithms.validateAlgorithmName({ name });
        const algorithm = await db.algorithms.readme.fetch({ name });
        if (!algorithm) {
            throw new ResourceNotFoundError('readme', name);
        }
        const result = await db.algorithms.readme.delete({ name });
        return result;
    }
}

module.exports = new Readme();
