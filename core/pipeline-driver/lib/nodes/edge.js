const create = (options) => ({
    waitNode: options.isWaitNode,
    waitBatch: options.isWaitBatch,
    waitAny: options.isWaitAny
})
module.exports = create;