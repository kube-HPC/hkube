const create = (options) => ({
    waitNode: options.isWaitNode,
    waitBatch: options.isWaitBatch,
    waitAnyBatch: options.isWaitAnyBatch
})
module.exports = create;