const NodeBase = require('./node-base');

class WaitBatch extends NodeBase {

    constructor(options) {
        super(options);
        this.waitBatch = true;
    }
}

module.exports = WaitBatch;