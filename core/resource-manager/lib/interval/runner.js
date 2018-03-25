const AdapterController = require('../adapters/adapters-controller');
const MetricsRunner = require('../metrics/metrics-runner');
const metricsReducer = require('../metrics/metrics-reducer');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').RUNNER;

class Runner {
    constructor() {
        this._metricsRunner = null;
        this._adapterController = null;
    }

    async init(options) {
        this._metricsRunner = new MetricsRunner(options);
        this._adapterController = new AdapterController(options);

        setInterval(async () => {
            if (this._working) {
                return;
            }
            this._working = true;
            try {
                const adaptersResults = await this._adapterController.getData();
                const metricsResults = this._metricsRunner.run(adaptersResults);
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