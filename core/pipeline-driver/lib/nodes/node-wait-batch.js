const NodeBase = require('./node-base');

class WaitBatch extends NodeBase {

    constructor(options) {
        super(options);
        this.waitIndex = options.waitIndex;
    }
}

module.exports = WaitBatch;