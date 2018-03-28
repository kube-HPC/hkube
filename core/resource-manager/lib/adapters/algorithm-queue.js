const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const metricsProvider = require('../monitoring/metrics-provider');

class AlgorithmQueueAdapter extends Adapter {

    constructor(settings, options) {
        super(settings, options);
    }

    async getData() {
        let data = this.cache.get();
        if (!data) {
            const algorithms = await stateManager.getAlgorithmQueue();
            metricsProvider.setPodsRequests(algorithms);
            data = [];
            algorithms.forEach(q => {
                data.push(...q.data);
            });
            data = data.map(q => ({ alg: q.algorithmName, batch: q.batchPlace, score: q.calculated.score }));
            this.cache.set(data);
        }
        return data;
    }
}

module.exports = AlgorithmQueueAdapter;