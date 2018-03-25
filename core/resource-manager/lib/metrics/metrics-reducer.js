
const utils = require('../utils/utils');

class MetricsReducer {
    reduce(options) {
        const map = {};
        options.forEach(metric => {
            metric.data = metric.data || [];
            metric.data.reduce((prev, cur) => {
                if (cur.alg in prev) {
                    prev[cur.alg].pods += cur.data * metric.weight
                }
                else {
                    prev[cur.alg] = { pods: cur.data * metric.weight };
                }
                prev[cur.alg].pods = Math.round(prev[cur.alg].pods);
                return prev;
            }, map)
        });

        const results = utils.mapToArray(map, ['alg', 'data']);
        return results;
    }
}

module.exports = new MetricsReducer();