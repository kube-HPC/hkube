const NodeBase = require('./node-base');

class Batch extends NodeBase {

    constructor(options) {
        super(options);
        this.storage = options.storage;
        this.batchIndex = options.batchIndex;
    }
}

module.exports = Batch;