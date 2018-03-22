
const utils = require('../utils/utils');

class MetricsReducer {
    reduce(options) {
        const map = {};
        console.log(JSON.stringify(options, null, 2));
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
        console.log(JSON.stringify(results, null, 2));
        return results;
    }
}

module.exports = new MetricsReducer();