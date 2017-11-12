const stateManager = require('lib/state/state-manager');


/**
 * add a pipeline
 * adds the given pipeline to the store.
 *
 * pipeline Pipeline pipeline descriptor to be added to the store
 * returns defaultResponse
 **/
exports.updatePipeline = async (options) => {
    return await stateManager.setPipeline();
}

/**
 * delete stored pipeline
 * removes selected stored pipeline from store
 *
 * pipelineName String pipeline name to get from the store
 * returns defaultResponse
 **/
exports.deletePipeline = async (options) => {

}

/**
 * get pipeline data from store
 * returns stored pipeline
 *
 * pipelineName String pipeline name to get from the store
 * returns piplineNamesList
 **/
exports.getPipeline = async (options) => {
    return await stateManager.getPipeline(options);
}

/**
 * get all pipelines
 * returns all pipelines that are currently in the store (names list)
 *
 * returns piplineNames
 **/
exports.getPipelines = async () => {
    return await stateManager.getPipeline();
}
