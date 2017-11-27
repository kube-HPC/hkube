const validator = require('lib/validation/api-validator');
const Pipeline = require('lib/entities/Pipeline')
const stateManager = require('lib/state/state-manager');
const { ResourceNotFoundError, ResourceExistsError, InvalidDataError, } = require('lib/errors/errors');

class StoreService {

    /**
     * add a pipeline
     * adds the given pipeline to the store.
     *
     * pipeline Pipeline pipeline descriptor to be added to the store
     * returns defaultResponse
     **/
    async updatePipeline(options) {
        validator.validateUpdatePipeline(options);
        const pipe = await stateManager.getPipeline(options);
        if (!pipe) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        if (Object.keys(options).length === 1) {
            throw new InvalidDataError('nothing to update with this request');
        }
        const pipeline = Object.assign({}, pipe, options);
        return await stateManager.setPipeline(pipeline);
    }

    /**
     * delete stored pipeline
     * removes selected stored pipeline from store
     *
     * pipelineName String pipeline name to get from the store
     * returns defaultResponse
     **/
    async deletePipeline(options) {
        validator.validateDeletePipeline(options);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return await stateManager.deletePipeline(options);
    }

    /**
     * get pipeline data from store
     * returns stored pipeline
     *
     * pipelineName String pipeline name to get from the store
     * returns piplineNamesList
     **/
    async getPipeline(options) {
        validator.validateGetPipeline(options);
        const pipeline = await stateManager.getPipeline(options);
        if (!pipeline) {
            throw new ResourceNotFoundError('pipeline', options.name);
        }
        return pipeline;
    }

    async getPipelines() {
        return await stateManager.getPipelines();
    }

    /**
     * add a pipeline
     * adds the given pipeline to the store.
     *
     * pipeline Pipeline pipeline descriptor to be added to the store
     * returns defaultResponse
     **/
    async insertPipeline(options) {
        validator.validateInsertPipeline(options);
        const pipe = await stateManager.getPipeline(options);
        if (pipe) {
            throw new ResourceExistsError('pipeline', options.name);
        }
        const pipeline = new Pipeline(options);
        return await stateManager.setPipeline(pipeline);
    }
}

module.exports = new StoreService();
