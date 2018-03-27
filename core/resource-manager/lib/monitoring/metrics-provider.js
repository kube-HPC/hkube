const { metrics } = require('@hkube/metrics');
const log = require('@hkube/logger').GetLogFromContainer();
const CONST = require('./const');

class MetricsProvider {

    async init(options) {
        await metrics.init(options.metrics);
        this._register();
    }

    _register() {
        this.algorithmsAmount = metrics.addGaugeMeasure({
            name: CONST.ALGORITHMS_AMOUNT,
            labels: [CONST.ALGORITHM_NAME],
        });
    }

    set(data) {
        const metric = metrics.get(CONST.ALGORITHMS_AMOUNT);
        const metricData = {
            id: 33, // ???,
            labelValues: {
                [CONST.ALGORITHM_NAME]: 'name'
            }
        };
        metric.set(data.pods);
    }
}

module.exports = new MetricsProvider();