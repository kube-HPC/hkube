
const Metric = require('./Metric');

class K8sMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        return [];
    }
}

module.exports = K8sMetric;