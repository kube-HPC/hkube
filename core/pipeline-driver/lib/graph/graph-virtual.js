const clone = require('clone');
const uuidv4 = require('uuid/v4');
const GraphBase = require('./graph-base');

class VirtualGraph extends GraphBase {

    constructor() {
        super();
    }

    getCopy(source, target) {
        const node = clone(this.findByEdge(source, target));
        node.id = uuidv4();
        return node;
    }
}

module.exports = VirtualGraph;