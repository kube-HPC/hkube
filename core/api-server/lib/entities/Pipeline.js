
const Node = require('./Node');

class Pipeline {
    constructor(options) {
        this.name = options.name;
        this.nodes = options.nodes.map(n => new Node(n));
        this.flowInput = options.flowInput;
        this.webhooks = options.webhooks;
        this.batchTolerance = options.batchTolerance;
    }
}

module.exports = Pipeline;
