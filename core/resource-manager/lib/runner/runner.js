
const log = require('@hkube/logger').GetLogFromContainer();
const adapterController = require('../adapters/adapters-controller');
const metricsController = require('../metrics/metrics-controller');
const metricsProvider = require('../monitoring/metrics-provider');
const logger = require('../utils/logger');
const component = require('../consts/components').RUNNER;

class Runner {
    init(options) {
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
        const adaptersResults = await adapterController.getData();
        return this._setMetrics(adaptersResults);
    }

    async _setMetrics(adaptersResults) {
        metricsProvider.setPodsRequests(adaptersResults.algorithms.queue);
        adaptersResults.algorithms.queue = adaptersResults.algorithms.queue.filter(q => adaptersResults.algorithms.templatesStore[q.name]);
        adaptersResults.pipelines.queue = adaptersResults.pipelines.queue.filter(q => adaptersResults.pipelines.templatesStore[q.name]);
        const metricsResults = metricsController.run(adaptersResults);
        await adapterController.setData(metricsResults);
        metricsProvider.setPodsAllocations(metricsResults);
        return metricsResults;
    }
}

module.exports = new Runner();
