
const Metric = require('../Metric');

class K8sMetric extends Metric {
    constructor(options, name) {
        super(options, name);
        this.weight = 0.1;
    }

    calc() {
        return [];
    }
}

module.exports = K8sMetric;
