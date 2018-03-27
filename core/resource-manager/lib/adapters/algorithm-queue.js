const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');

class AlgorithmQueueAdapter extends Adapter {

    constructor(settings, options) {
        super(settings, options);
    }

    async getData() {
        let data = this.cache.get();
        if (!data) {
            data = await stateManager.getAlgorithmQueue();
            this.cache.set(data);
        }
        const mergedQueue = [];
        data.forEach(q => {
            mergedQueue.push(...q.data);
        });
        return mergedQueue.map(q => ({ alg: q.algorithmName, batch: q.batchPlace, score: q.calculated.score }));
    }
}

module.exports = AlgorithmQueueAdapter;