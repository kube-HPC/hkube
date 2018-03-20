
const Adapter = require('./Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;

class PrometheusAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
    }

    getData() {
    }
}

module.exports = PrometheusAdapter;