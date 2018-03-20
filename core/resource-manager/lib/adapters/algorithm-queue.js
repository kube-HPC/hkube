
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const stub = require('../../tests/mocks/algorithm-queue.json');

class AlgorithmQueueAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
        this._stubData();
    }

    _stubData() {
        Promise.all(stub.map(a => stateManager.setQueueMetrics(a)));
    }

    async getData() {
        const algorithmQueue = await stateManager.getAlgorithmQueue();
        let mergedQueue = [];
        algorithmQueue.forEach(q => {
            mergedQueue = mergedQueue.concat(q.data);
        });
        mergedQueue = mergedQueue.map(q => ({ alg: q.algorithmName, batch: q.batchPlace, score: q.calculated.score * 10 }));
        return mergedQueue;
    }
}

module.exports = AlgorithmQueueAdapter;