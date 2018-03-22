const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');

class AlgorithmQueueAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
    }

    async getData() {
        const algorithmQueue = await stateManager.getAlgorithmQueue();
        let mergedQueue = [];
        algorithmQueue.forEach(q => {
            mergedQueue = mergedQueue.concat(q.data);
        });
        return mergedQueue.map(q => ({ alg: q.algorithmName, batch: q.batchPlace, score: q.calculated.score }));
    }
}

module.exports = AlgorithmQueueAdapter;