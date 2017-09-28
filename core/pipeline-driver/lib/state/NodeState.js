
class NodeState {
    constructor(options) {
        this.jobID = options.jobID;
        this.status = options.status;
        this.internalData = options.internalData;
    }
}

module.exports = NodeState;