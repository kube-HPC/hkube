const adapterManager = require('../resource-adapters/adapters-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;

class Runner {

    constructor() {

    }

    async init() {
        setInterval(async () => {
            if (this._working) {
                return;
            }

            this._working = true;

            log.info(`adapterManager started`, { component });

            const adapterResults = await Promise.all(adapterManager.adapters.map(a => a.getData()));
            const metricsResults = metrics.map(m => {
                m.calc(adapterResults);
            });
            log.info(`adapterManager finished`, { component });

            this._working = false;


        }, 5000);
    }
}

module.exports = new Runner();