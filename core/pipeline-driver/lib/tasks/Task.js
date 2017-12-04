
const States = require('lib/state/States');

class Task {
    constructor(options) {
        this.taskId = options.taskId;
        this.status = options.status || States.CREATING;
        this.nodeName = options.nodeName;
        this.algorithm = options.algorithm
        this.input = options.input;
        this.batchID = options.batchID;
        this.result = options.result;
        this.error = options.error;
    }
}

module.exports = Task;