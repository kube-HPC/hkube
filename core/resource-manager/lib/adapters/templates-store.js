
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
            data: { cpu: 5, mem: 28372378 }
        },
        {
            alg: 'yellow-alg',
            data: { cpu: 3, mem: 28372378 }
        },
        {
            alg: 'black-alg',
            data: { cpu: 1, mem: 28372378 }
        }]
        Promise.all(algs.map(a => stateManager.setStoreTemplates(a)));
    }

    async getData() {
        log.info(`adapter started`, { component });
        const map = Object.create(null);
        const response = await stateManager.getStoreTemplates();
        response.forEach(r => {
            map[r.alg] = r.data;
        });
        return map;
    }
}

module.exports = TemplatesStore;