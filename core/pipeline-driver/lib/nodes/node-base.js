const Task = require('lib/tasks/Task');
const States = require('lib/state/States');

class NodeBase extends Task {

    constructor(options) {
        super(options);
        this.nodeName = options.nodeName;
        this.algorithmName = options.algorithmName;
        this.input = options.input;
        this.status = options.status || States.CREATING;
        this.error = options.error;
        this.result = options.result;
    }
}

module.exports = NodeBase;