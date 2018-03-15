
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').ALGORITHM_QUEUE;

class AlgorithmQueueAdapter extends Adapter {

    constructor(options) {
        super(options);
        this._stubData();
    }

    _stubData() {
        const algs = [{
            alg: 'green-alg',
            data: { score: 9 }
        },
        {
            alg: 'yellow-alg',
            data: { score: 8 }
        },
        {
            alg: 'black-alg',
            data: { score: 7 }
        }]
        Promise.all(algs.map(a => stateManager.setQueueMetrics(a)));
    }

    getData() {
        log.info(`adapter started`, { component });
        return stateManager.getQueueMetrics();
    }
}

module.exports = AlgorithmQueueAdapter;