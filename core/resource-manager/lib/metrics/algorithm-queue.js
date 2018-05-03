
const Metric = require('./Metric');
const queueUtils = require('../utils/algorithm-queue');
const ResourceAllocator = require('../resources/resource-allocator');

class AlgorithmQueueMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.settings.resourceThresholds, ...options });
        let algorithmQueue = queueUtils.order(options.algorithmQueue);
        algorithmQueue.forEach(r => resourceAllocator.allocate(r.name));
        let results = resourceAllocator.results();
        results = queueUtils.normalize(options.algorithmQueue, results);
        return results;
    }
}

module.exports = AlgorithmQueueMetric;