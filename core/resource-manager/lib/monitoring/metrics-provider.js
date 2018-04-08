const { metrics } = require('@hkube/metrics');
const log = require('@hkube/logger').GetLogFromContainer();
const CONST = require('./const');

class MetricsProvider {

    async init(options) {
        await metrics.init(options.metricsMeasure);
        this._register();
    }

    _register() {
        this._podsRequestsMeasure = metrics.addGaugeMeasure({
            name: CONST.PODS_REQUESTS,
            labels: [CONST.ALGORITHM_NAME],
        });
        this._podsAllocationsMeasure = metrics.addGaugeMeasure({
            name: CONST.PODS_ALLOCATIONS,
            labels: [CONST.ALGORITHM_NAME],
        });
    }

    setPodsRequests(data) {
        data.forEach(d => {
            this._podsRequestsMeasure.set({ value: d.data.length, labelValues: { [CONST.ALGORITHM_NAME]: d.queueName } });
        });
    }

    setPodsAllocations(data) {
        data.forEach(d => {
            this._podsAllocationsMeasure.set({ value: d.data.pods, labelValues: { [CONST.ALGORITHM_NAME]: d.name } });
        });
    }
}

module.exports = new MetricsProvider();