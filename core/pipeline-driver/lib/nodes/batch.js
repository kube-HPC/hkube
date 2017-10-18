const States = require('lib/state/States');
const NodeBase = require('lib/nodes/node-base');

class Batch extends NodeBase {

    constructor(options) {
        super(options);
        this.batchID = options.batchID;
    }
}

module.exports = Batch;