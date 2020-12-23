const log = require('@hkube/logger').GetLogFromContainer();
const AdapterController = require('../adapters/adapters-controller');
const MetricsController = require('../metrics/metrics-controller');
const adapterSettings = require('../adapters/settings');
const metricsSettings = require('../metrics/settings');
const StoreController = require('../store/store-controller');
// const metricsProvider = require('../monitoring/metrics-provider');
const component = require('../consts/components').RUNNER;

class Runner {
    async init(options) {
        this._adapterController = new AdapterController(options, adapterSettings);
        this._metricsController = new MetricsController(options, metricsSettings);
        this._storeController = new StoreController(options);

        await this._adapterController.init();
        await this._metricsController.init();

        log.info(`running with ${options.recommendationMode} recommendation mode and interval of: ${options.interval / 1000} sec`, { component });

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
        log.throttle.error(error.message, { component }, error);
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
        // metricsProvider.setPodsRequests(adaptersResults.algorithms.queue);
        const results = this._filterQueue(adaptersResults);
        const metricsResults = this._metricsController.run(results);
        await this._storeController.setData(metricsResults);
        // metricsProvider.setPodsAllocations(metricsResults);
        return metricsResults;
    }

    _filterQueue(adaptersResults) {
        const aq = adaptersResults.algorithms.queue;
        const dq = adaptersResults.drivers.queue;

        const aqf = aq.filter(q => adaptersResults.algorithms.templatesStore[q.name]);
        const dqf = dq.filter(q => adaptersResults.drivers.templatesStore[q.name]);

        const results = {
            ...adaptersResults,
            algorithms: {
                ...adaptersResults.algorithms,
                queue: aqf
            },
            drivers: {
                ...adaptersResults.drivers,
                queue: dqf
            }
        };
        return results;
    }
}

module.exports = new Runner();
