
const Metric = require('./Metric');
const orderBy = require('lodash.orderby');
const groupBy = require('lodash.groupby');
const ResourceAllocator = require('../resource-handlers/resource-allocator');

class AlgorithmQueueMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const resourceAllocator = new ResourceAllocator(this.settings, options);
        const algorithmQueue = orderBy(options.algorithmQueue, q => q.score, 'desc');
        algorithmQueue.forEach(r => {
            resourceAllocator.allocate(r.alg);
        });
        const results = resourceAllocator.results();
        return results;
    }
}

module.exports = AlgorithmQueueMetric;