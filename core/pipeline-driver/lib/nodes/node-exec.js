
class NodeExec {
    constructor(options) {
        this.algorithmExecution = true;
        this.nodeName = options.nodeName;
        this.algorithmName = options.algorithmName;
        this.batch = [];
    }
}

module.exports = NodeExec;
