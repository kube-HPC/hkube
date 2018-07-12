const Adapter = require('../Adapter');
const stateManager = require('../../state/state-manager');
const metricsProvider = require('../../monitoring/metrics-provider');

class AlgorithmQueueAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
        this.mandatory = true;
    }

    async getData() {
        const queue = await stateManager.getAlgorithmQueue();
        queue.forEach(al => {
            al.data = al.data.map(a => ({ name: al.name, score: a }));
        });
        metricsProvider.setPodsRequests(queue);
        return queue;
    }
}

module.exports = AlgorithmQueueAdapter;
