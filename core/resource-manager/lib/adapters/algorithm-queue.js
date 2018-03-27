const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');

class AlgorithmQueueAdapter extends Adapter {

    constructor(settings, options) {
        super(settings, options);
    }

    async getData() {
        const algorithmQueue = await stateManager.getAlgorithmQueue();
        const mergedQueue = [];
        algorithmQueue.forEach(q => {
            mergedQueue.push(...q.data);
        });
        return mergedQueue.map(q => ({ alg: q.algorithmName, batch: q.batchPlace, score: q.calculated.score }));
    }
}

module.exports = AlgorithmQueueAdapter;