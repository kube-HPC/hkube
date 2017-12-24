
class NodeResult {

    constructor(options) {
        this.nodeName = options.nodeName;
        this.batchID = options.batchID;
        this.algorithmName = options.algorithmName;
        this.result = options.result;
        this.error = options.error;
    }
}

module.exports = NodeResult;