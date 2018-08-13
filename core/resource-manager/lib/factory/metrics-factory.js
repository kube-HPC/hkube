const algorithmsFlat = require('../metrics/algorithms-flat');
const algorithmsMap = require('../metrics/algorithms-map');
const driversFlat = require('../metrics/drivers-flat');
const driversMap = require('../metrics/drivers-map');

const metricTypes = {
    flat: {
        algorithms: algorithmsFlat,
        drivers: driversFlat
    },
    map: {
        algorithms: algorithmsMap,
        drivers: driversMap
    }
};

class MetricsFactory {
    getMetrics(type) {
        return metricTypes[type];
    }
}

module.exports = new MetricsFactory();
