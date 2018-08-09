
const log = require('@hkube/logger').GetLogFromContainer();
const AdapterController = require('../adapters/adapters-controller');
const MetricsController = require('../metrics/metrics-controller');
const adapterSettings = require('../adapters/settings');
const metricsSettings = require('../metrics/settings');
const metricsProvider = require('../monitoring/metrics-provider');
const logger = require('../utils/logger');
const component = require('../consts/components').RUNNER;

class Runner {
    async init(options) {
        this._adapterController = new AdapterController(options, adapterSettings);
        this._metricsController = new MetricsController(options, metricsSettings);

        await this._adapterController.init();
        await this._metricsController.init();

        log.info(`running with current interval of: ${options.interval / 1000} sec`, { component });

        setInterval(async () => {
            if (this._working) {
                return;
            }
            try {
                this._working = true;
                await this._doWork();
            }
            catch (e) {
                this._onError(e);
            }
            finally {
                this._working = false;
            }
        }, options.interval);
    }

    _onError(error) {
        logger.log(error, component);
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
        return this._setMetrics(adaptersResults);
    }

    async _setMetrics(adaptersResults) {
        metricsProvider.setPodsRequests(adaptersResults.algorithms.queue);
        adaptersResults.algorithms.queue = adaptersResults.algorithms.queue.filter(q => adaptersResults.algorithms.templatesStore[q.name]);
        adaptersResults.drivers.queue = adaptersResults.drivers.queue.filter(q => adaptersResults.drivers.templatesStore[q.name]);
        const metricsResults = this._metricsController.run(adaptersResults);
        await this._adapterController.setData(metricsResults);
        metricsProvider.setPodsAllocations(metricsResults);
        return metricsResults;
    }
}

module.exports = new Runner();
