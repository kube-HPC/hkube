const adapterController = require('../adapters/adapters-controller');
const metricsRunner = require('../metrics/metrics-runner');
const metricsReducer = require('../metrics/metrics-reducer');
const resourceDecider = require('../resource-handlers/resource-decider');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').RUNNER;

class Runner {

    async init(options) {
        setInterval(async () => {
            if (this._working) {
                return;
            }
            this._working = true;
            try {
                const adaptersResults = await adapterController.getData();
                const metricsResults = metricsRunner.run(adaptersResults);
                const resourceResults = metricsReducer.reduce(metricsResults);
                await stateManager.setResourceRequirements(resourceResults);
            }
            catch (error) {
                log.error(error.message, { component });
            }
            finally {
                this._working = false;
            }
        }, options.interval);
    }
}

module.exports = new Runner();