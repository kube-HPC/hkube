const resourceDecider = require('../resource-handlers/resource-decider');

class Metric {

    constructor(options) {
        this.name = options.name;
        this.weight = options.weight;
    }

    calcBase(options) {
        return resourceDecider.run(options);
    }
}

module.exports = Metric;