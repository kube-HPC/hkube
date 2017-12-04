const States = require('lib/state/States');

class NodeBase {

    constructor(options) {
        this.name = options.name;
        this.algorithm = options.algorithm;
        this.input = options.input;
        this.state = options.state || States.CREATING;
        this.error = null;
        this.result = null;
    }
}

module.exports = NodeBase;