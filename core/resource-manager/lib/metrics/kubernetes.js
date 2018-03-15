
const Metric = require('./Metric');

class KubernetesMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(data) {
        return data => this.weight * (Date.now() - 233) / 9
    }
}

module.exports = KubernetesMetric;