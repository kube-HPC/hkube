const States = require('../state/NodeStates');

class GraphNode {
    constructor(options) {
        this.nodeName = options.nodeName;
        this.algorithmName = options.algorithmName;
        this.extraData = options.extraData;
        this.input = options.input;
        this.status = States.CREATING;
        this.parentOutput = options.parentOutput;
        this.batch = [];
    }
}

module.exports = GraphNode;
