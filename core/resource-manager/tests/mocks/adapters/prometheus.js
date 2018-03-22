
const Adapter = require('../../../lib/adapters/Adapter');
const prometheus = require('../data/prometheus.json');

class PrometheusAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
    }

    getData() {
        return prometheus;
    }
}

module.exports = PrometheusAdapter;