const States = require('lib/state/States');

class Node {

    constructor(options) {
        this.name = options.name;
        this.batchID = options.batchID;
        this.algorithm = options.algorithm;
        this.input = options.input;
        this.state = States.PENDING;
        this.error = null;
        this.result = null;
    }
}

module.exports = Node;