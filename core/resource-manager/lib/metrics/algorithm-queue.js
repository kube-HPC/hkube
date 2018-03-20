
const Metric = require('./Metric');

class AlgorithmQueueMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(options) {
        return this.calcBase(options);
    }
}

module.exports = AlgorithmQueueMetric;