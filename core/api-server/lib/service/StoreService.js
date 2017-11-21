const stateManager = require('lib/state/state-manager');
const ResourceNotFoundError = require('lib/errors/ResourceNotFoundError');
const InvalidNameError = require('lib/errors/InvalidNameError');

class StoreService {

    /**
     * add a pipeline
     * adds the given pipeline to the store.
     *
     * pipeline Pipeline pipeline descriptor to be added to the store
     * returns defaultResponse
     **/
    async updatePipeline(options) {
        return await stateManager.setPipeline();
    }

    /**
     * delete stored pipeline
     * removes selected stored pipeline from store
     *
     * pipelineName String pipeline name to get from the store
     * returns defaultResponse
     **/
    async deletePipeline(options) {
        return await stateManager.getPipelines(options);
    }

    /**
     * get pipeline data from store
     * returns stored pipeline
     *
     * pipelineName String pipeline name to get from the store
     * returns piplineNamesList
     **/
    async getPipeline(options) {
        const pipeline = await stateManager.getPipeline({ name: options.name });
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
        return await stateManager.setPipeline();
    }
}

module.exports = new StoreService();
