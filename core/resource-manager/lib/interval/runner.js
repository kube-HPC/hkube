const adapterController = require('../adapters/adapters-controller');
const metricsRunner = require('../metrics/metrics-runner');
const resourceDecider = require('../resource-handlers/resource-decider');
const stateManager = require('../state/state-manager');

class Runner {

    async init(options) {

        setInterval(async () => {
            if (this._working) {
                return;
            }
            this._working = true;
            const adaptersResults = await adapterController.getData();
            const metricsResults = metricsRunner.run(adaptersResults);
            const resourceResults = resourceDecider.run(metricsResults);
            await stateManager.setResourceRequirements(resourceResults);
            this._working = false;

        }, options.interval);
    }
}

module.exports = new Runner();