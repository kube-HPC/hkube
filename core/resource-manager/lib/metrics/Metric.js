const resourceDecider = require('../resource-handlers/resource-decider');

class Metric {

    constructor(options) {
        this.name = options.name;
        this.weight = options.weight;
    }
}

module.exports = Metric;