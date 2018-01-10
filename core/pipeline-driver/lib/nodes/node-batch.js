const NodeBase = require('./node-base');

class Batch extends NodeBase {

    constructor(options) {
        super(options);
        this.batchID = options.batchID;
        this.batchIndex = options.batchIndex;
    }
}

module.exports = Batch;