
const utils = require('../utils/utils');

class MetricsReducer {

    /**
     * Take each metric
     * 
     * @param {any} options 
     * @returns 
     * 
     * @memberOf MetricsReducer
     */
    reduce(options) {
        const map = {};
        options.forEach(metric => {
            metric.data = metric.data || [];
            metric.data.reduce((prev, cur) => {
                if (cur.name in prev) {
                    prev[cur.name].pods += cur.data * metric.weight
                }
                else {
                    prev[cur.name] = { pods: cur.data * metric.weight };
                }
                prev[cur.name].pods = Math.round(prev[cur.name].pods);
                return prev;
            }, map)
        });

        const results = utils.mapToArray(map, ['alg', 'data']);
        return results;
    }
}

module.exports = new MetricsReducer();