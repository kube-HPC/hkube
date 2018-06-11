const Adapter = require('../Adapter');
const stateManager = require('../../state/state-manager');
const metricsProvider = require('../../monitoring/metrics-provider');

class AlgorithmQueueAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
    }

    async getData() {
        const algorithms = await stateManager.getAlgorithmQueue();
        algorithms.forEach(al => {
            al.data = al.data.map(a => ({ name: a.algorithmName, score: a.calculated.score }));
        });
        metricsProvider.setPodsRequests(algorithms);
        return algorithms;
    }
}

module.exports = AlgorithmQueueAdapter;
