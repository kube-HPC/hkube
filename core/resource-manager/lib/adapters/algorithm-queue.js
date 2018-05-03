const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const metricsProvider = require('../monitoring/metrics-provider');

class AlgorithmQueueAdapter extends Adapter {

    constructor(settings, options) {
        super(settings, options);
    }

    async getData() {
        const algorithms = await stateManager.getAlgorithmQueue();
        metricsProvider.setPodsRequests(algorithms);
        let requests = [];
        const emptyAlgorithms = [];
        algorithms.forEach(q => {
            if (q.data.length === 0) {
                emptyAlgorithms.push({
                    alg: q.queueName,
                    data: { pods: 0 }
                })
            }
            else {
                requests.push(...q.data);
            }
        });
        requests = requests.map(q => ({ name: q.algorithmName, score: q.calculated.score }));
        return { requests, emptyAlgorithms };
    }
}

module.exports = AlgorithmQueueAdapter;