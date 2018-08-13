const { metrics } = require('@hkube/metrics');
const { groupBy } = require('../utils/utils');
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
            this._podsRequestsMeasure.set({ value: d.data.length, labelValues: { [CONST.ALGORITHM_NAME]: d.name } });
        });
    }

    setPodsAllocations(data) {
        const group = groupBy(data.algorithms, 'name');
        group.forEach(d => {
            this._podsAllocationsMeasure.set({ value: d.data.pods, labelValues: { [CONST.ALGORITHM_NAME]: d.name } });
        });
    }
}

module.exports = new MetricsProvider();
