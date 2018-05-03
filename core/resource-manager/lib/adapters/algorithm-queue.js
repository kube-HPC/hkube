const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const metricsProvider = require('../monitoring/metrics-provider');

class AlgorithmQueueAdapter extends Adapter {

    constructor(options) {
        super(options);
    }

    async getData() {
        const algorithms = await stateManager.getAlgorithmQueue();
        metricsProvider.setPodsRequests(algorithms);
        return algorithms;
    }
}

module.exports = AlgorithmQueueAdapter;