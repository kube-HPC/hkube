const Metric = require('../Metric');
const { orderBy, score } = require('../../utils/utils');
const queueUtils = require('../../utils/queue');
const MAX_CPU = 30;

class TemplatesStoreMetric extends Metric {
    constructor(options) {
        super(options);
    }

    calc(options) {
        let results;
        let queue = queueUtils.order(options.algorithms.queue);
        if (queue.length > 0) {
            const ts = options.algorithms.templatesStore;
            queue = queue.map(a => ({ name: a.name, cpu: ts[a.name].cpu }));
            results = queue.map(a => ({ name: a.name, score: score(a.cpu, MAX_CPU) }));
            results = orderBy(results, q => q.score, 'desc');
        }
        return results;
    }
}

module.exports = TemplatesStoreMetric;
