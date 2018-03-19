
const Adapter = require('./Adapter');
const orderBy = require('lodash.orderby');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').ALGORITHM_QUEUE;
const algorithmQueue = require('../../tests/mocks/algorithm-queue.json');

class AlgorithmQueueAdapter extends Adapter {

    constructor(options) {
        super(options);
        this._stubData();
    }

    _stubData() {
        Promise.all(algorithmQueue.map(a => stateManager.setQueueMetrics(a)));
    }

    async getData() {
        log.info(`adapter started`, { component });
        const algorithmQueue = await stateManager.getAlgorithmQueue();
        let mergedQueue = [];
        algorithmQueue.forEach(q => {
            mergedQueue = mergedQueue.concat(q.data);
        });
        mergedQueue = orderBy(mergedQueue, q => q.calculated.score, 'desc');
        return mergedQueue;
    }
}

module.exports = AlgorithmQueueAdapter;