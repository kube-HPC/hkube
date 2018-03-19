const adapterManager = require('../adapters/adapters-manager');
const metricsRunner = require('../metrics/metrics-runner');
const resourceDecider = require('../resource-handlers/resource-decider');
const stateManager = require('../state/state-manager');
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
            const adapterResults = await adapterManager.getData();
            const metricsResults = metricsRunner.run(adapterResults);
            const resourceResults = resourceDecider.run(metricsResults);
            await stateManager.setResourceRequirements(resourceResults);
            this._working = false;
        }, 1000);
    }
}

module.exports = new Runner();