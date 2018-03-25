
const Metric = require('./Metric');

class K8sMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        return this.calcBase(options);
    }
}

module.exports = K8sMetric;