
const Metric = require('./Metric');
const orderBy = require('lodash.orderby');
const groupBy = require('lodash.groupby');
const ResourceAllocator = require('../resources/resource-allocator');

class AlgorithmQueueMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.settings.resourceThresholds, ...options });
        const algorithmQueue = orderBy(options.algorithmQueue, q => q.score, 'desc');
        algorithmQueue.forEach(r => resourceAllocator.allocate(r.name));
        const results = resourceAllocator.results();
        return results;
    }
}

module.exports = AlgorithmQueueMetric;