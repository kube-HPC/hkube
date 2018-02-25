const NodeBase = require('./node-base');

class WaitBatch extends NodeBase {

    constructor(options) {
        super(options);
        this.waitBatch = true;
        this.batchIndex = options.batchIndex;
    }
}

module.exports = WaitBatch;