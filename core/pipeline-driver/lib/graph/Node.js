
class Node {

    constructor(options) {
        this.name = options.name;
        this.batchID = options.batchID;
        this.algorithm = options.algorithm;
        this.input = options.input;
        this.state = 'pending';
        this.result = null;
    }
}

module.exports = Node;