
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;

class TemplatesStore extends Adapter {

    constructor(options) {
        super(options);
        this._stubData();
    }

    _stubData() {
        const algs = [{
            alg: 'green-alg',
            data: { cpu: 5 }
        },
        {
            alg: 'yellow-alg',
            data: { cpu: 3 }
        },
        {
            alg: 'black-alg',
            data: { cpu: 1 }
        }]
        Promise.all(algs.map(a => stateManager.setStoreTemplates(a)));
    }

    async getData() {
        log.info(`adapter started`, { component });
        return stateManager.getStoreTemplates();
    }
}

module.exports = TemplatesStore;