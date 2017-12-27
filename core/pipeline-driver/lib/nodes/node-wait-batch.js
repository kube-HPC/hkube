const NodeBase = require('lib/nodes/node-base');

class WaitBatch extends NodeBase {

    constructor(options) {
        super(options);
        this.waitBatch = true;
    }
}

module.exports = WaitBatch;