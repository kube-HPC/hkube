const States = require('lib/state/States');
const NodeBase = require('lib/nodes/node-base');

class Node extends NodeBase {

    constructor(options) {
        super(options);
        this.batch = [];
    }
}

module.exports = Node;