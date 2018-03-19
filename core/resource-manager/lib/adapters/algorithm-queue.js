
const Adapter = require('./Adapter');
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

    getData() {
        log.info(`adapter started`, { component });
        return stateManager.getAlgorithmQueue();
    }
}

module.exports = AlgorithmQueueAdapter;