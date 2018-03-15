
const Adapter = require('./Adapter');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;

class TemplatesStore extends Adapter {

    constructor(options) {
        super(options);
        this._data = new Map();
        const store = stateManager.watchStoreTemplates();
        if (store.data) {
            this._data.set(res.alg, res.data);
        }
        stateManager.on('templates-store', (res) => {
            this._data.set(res.alg, res.data);
        });
        this._stubData();
    }

    _stubData() {
        const algs = [{
            alg: 'green',
            cpu: 5
        },
        {
            alg: 'yellow',
            cpu: 2
        }]
        Promise.all(algs.map(a => stateManager.setStoreTemplates(a)));
    }

    async getData() {
        log.info(`adapter started`, { component });
        if (!this._data.size === 0) {
            this._data = await stateManager.getStoreTemplates();
        }
        return this._data;
    }
}

module.exports = TemplatesStore;