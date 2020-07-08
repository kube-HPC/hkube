const utils = require('../utils/utils');

class MetricsReducer {
    /**
     * Take each metric and reduce pods calculation
     */
    reduce(metrics) {
        const map = {};
        metrics.forEach((metric) => {
            metric.data = metric.data || [];
            metric.data.reduce((prev, cur) => {
                if (cur.name in prev) {
                    prev[cur.name].pods += cur.data * metric.weight;
                }
                else {
                    prev[cur.name] = { pods: cur.data * metric.weight };
                }
                return prev;
            }, map);
        });
        Object.values(map).forEach((v) => {
            v.pods = Math.ceil(v.pods);
        });
        const results = utils.mapToArray(map, ['name', 'data']);
        return results;
    }
}

module.exports = new MetricsReducer();
