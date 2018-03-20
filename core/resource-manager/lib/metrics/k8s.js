
const Metric = require('./Metric');

class K8sMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(options) {
        return this.calcBase(options);
    }
}

module.exports = K8sMetric;