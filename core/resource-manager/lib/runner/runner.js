
const AdapterController = require('../adapters/adapters-controller');
const MetricsRunner = require('../metrics/metrics-runner');
const metricsReducer = require('../metrics/metrics-reducer');
const logger = require('../utils/logger');
const metricsProvider = require('../monitoring/metrics-provider');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').RUNNER;

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
                logger.log(error);
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
        const results = await this._adapterController.getData();
        return Promise.all(Object.keys(results).map(k => this._setMetrics(k, results)));
    }

    async _setMetrics(type, results) {
        const metricsResults = this._metricsRunner.run(type, results);
        const resourceResults = metricsReducer.reduce(type, metricsResults);
        await this._adapterController.setData(type, resourceResults);
        metricsProvider.setPodsAllocations(resourceResults);
        return resourceResults;
    }
}

module.exports = new Runner();
