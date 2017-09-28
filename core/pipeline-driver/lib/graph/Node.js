
class Node {

    constructor(options) {
        this.name = options.name;
        this.batchID = options.batchID;
        this.algorithm = options.algorithm;

        this.inputs = options.inputs || {};
        this.inputs.standard = options.inputs.standard;
        this.inputs.batch = options.inputs.batch;
        this.inputs.previous = options.inputs.previous;

        this.state = 'pending';
        this.result = null;
    }
}

module.exports = Node;