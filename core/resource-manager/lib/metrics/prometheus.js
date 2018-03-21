
const Metric = require('./Metric');

class PrometheusMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(options) {

        return this.calcBase(options);
    }
}

module.exports = PrometheusMetric;