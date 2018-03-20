
const Metric = require('./Metric');

class TemplatesStoreMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(options) {
        return this.calcBase(options);
    }
}

module.exports = TemplatesStoreMetric;