const NodeBase = require('./node-base');

class Node extends NodeBase {
    constructor(options) {
        super(options);
        this.batch = [];
    }
}

module.exports = Node;
