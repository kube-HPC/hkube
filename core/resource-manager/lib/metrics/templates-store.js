
const Metric = require('./Metric');
const MAX_CPU = 1500;

class TemplatesStoreMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(data) {
        return this.weight * ((data.cpu < MAX_CPU ? Math.abs(job.batchPlace - (MAX_CPU + 1)) : MAX_CPU) / MAX_CPU)
    }
}

module.exports = TemplatesStoreMetric;