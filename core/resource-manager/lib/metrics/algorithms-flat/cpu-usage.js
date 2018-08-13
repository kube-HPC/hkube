const Metric = require('../Metric');
const { orderBy, arrayToMap, score } = require('../../utils/utils');
const queueUtils = require('../../utils/queue');
const MAX_CPU_USAGE = 300000;

class CpuUsageMetric extends Metric {
    constructor(options) {
        super(options);
    }

    calc(options) {
        let results;
        const queue = queueUtils.order(options.algorithms.queue);
        if (queue.length > 0 && options.algorithms.prometheus) {
            const algorithms = arrayToMap(options.algorithms.prometheus, ['algorithmName']);
            results = queue.map(a => ({ name: a.name, cpuUsage: algorithms[a.name] && algorithms[a.name].cpuUsage }));
            results = results.map(a => ({ name: a.name, score: score(a.cpuUsage, MAX_CPU_USAGE) }));
            results = orderBy(results, q => q.score, 'desc');
        }
        return results;
    }
}

module.exports = CpuUsageMetric;
