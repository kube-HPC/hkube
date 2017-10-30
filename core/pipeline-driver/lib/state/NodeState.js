
class NodeState {
    constructor(options) {
        this.status = options.status;
        this.nodeName = options.nodeName;
        this.batchID = options.batchID;
        this.result = options.result;
        this.error = options.error;
    }
}

module.exports = NodeState;