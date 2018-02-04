const NodeBase = require('./node-base');

class Batch extends NodeBase {

    constructor(options) {
        super(options);
        this.batchIndex = options.batchIndex;
    }
}

module.exports = Batch;