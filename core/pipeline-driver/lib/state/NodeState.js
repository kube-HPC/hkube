
class NodeState {
    constructor(options) {
        this.jobID = options.jobID;
        this.status = options.status;
        this.internalData = options.internalData;
        this.result = options.result;
        this.error = options.error;
    }
}

module.exports = NodeState;