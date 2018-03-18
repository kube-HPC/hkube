
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').ALGORITHM_QUEUE;

class AlgorithmQueueAdapter extends Adapter {

    constructor(options) {
        super(options);
        // this._stubData();
    }

    _stubData() {
        const algs = [{
            alg: 'green-alg',
            data: [{ score: 9 }, { score: 4 }]
        },
        {
            alg: 'yellow-alg',
            data: [{ score: 5 }, { score: 6 }]
        },
        {
            alg: 'black-alg',
            data: [{ score: 1 }, { score: 8 }]
        }]
        Promise.all(algs.map(a => stateManager.setQueueMetrics(a)));
    }

    getData() {
        log.info(`adapter started`, { component });
        return stateManager.getAlgorithmQueue();
    }
}

module.exports = AlgorithmQueueAdapter;