const AdapterController = require('../adapters/adapters-controller');
const MetricsRunner = require('../metrics/metrics-runner');
const metricsReducer = require('../metrics/metrics-reducer');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').RUNNER;
const metricsProvider = require('../monitoring/metrics-provider');

class Runner {

    async init(options) {
        this._adapterController = new AdapterController(options);
        this._metricsRunner = new MetricsRunner(options);
        this._run(options.interval);
    }

    _run(interval) {
        log.info(`running with current interval of: ${interval / 1000} sec`, { component });
        setInterval(async () => {
            if (this._working) {
                return;
            }
            try {
                this._working = true;
                await this._doWork();
            }
            catch (error) {
                log.error(error.message, { component });
            }
            finally {
                this._working = false;
            }
        }, interval);
    }

    /**
     * This method runs the following procedure:
     * 1) execute the adapters get data method in parallel
     * 2) execute each metric with all the adapters data returned
     * 3) take the metrics results and reduce by weight
     * 4) save the resource allocation results
     * 
     * @memberOf Runner
     */

    async _doWork() {
        const adaptersResults = await this._adapterController.getData();
        const metricsResults = this._metricsRunner.run(adaptersResults);
        const resourceResults = metricsReducer.reduce(metricsResults);
        await stateManager.setResourceRequirements(resourceResults);
        metricsProvider.setPodsAllocations(resourceResults);
        return resourceResults;
    }
}

module.exports = new Runner();