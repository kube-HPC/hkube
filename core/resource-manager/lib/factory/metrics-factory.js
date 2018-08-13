const algorithmsFlat = require('../metrics/algorithms-flat');
const algorithmsMap = require('../metrics/algorithms-map');
const drivers = require('../metrics/drivers');

const metricTypes = {
    flat: {
        algorithms: algorithmsFlat,
        drivers
    },
    map: {
        algorithms: algorithmsMap,
        drivers
    }
};

class MetricsFactory {
    getMetrics(type) {
        return metricTypes[type];
    }
}

module.exports = new MetricsFactory();
