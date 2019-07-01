const Task = require('../tasks/Task');
const States = require('../state/NodeStates');

class NodeBase extends Task {
    constructor(options) {
        super(options);
        this.nodeName = options.nodeName;
        this.algorithmName = options.algorithmName;
        this.extraData = options.extraData;
        this.input = options.input;
        this.storage = options.storage;
        this.status = options.status || States.CREATING;
        this.error = options.error;
        this.prevErrors = [];
        this.result = options.result;
    }
}

module.exports = NodeBase;
