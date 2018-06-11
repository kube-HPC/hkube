
const Metric = require('../Metric');
const orderBy = require('lodash.orderby');
const queueUtils = require('../../utils/algorithm-queue');
const ResourceAllocator = require('../../resources/resource-allocator');

class TemplatesStoreMetric extends Metric {
    constructor(options, name) {
        super(options, name);
        this.weight = 0.1;
    }

    calc(options) {
        const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.options.resourceThresholds, ...options.algorithms });
        let algorithmQueue = queueUtils.order(options.algorithms.queue);
        algorithmQueue = algorithmQueue.map(a => ({
            ...a,
            cpu: options.algorithms.templatesStore[a.name].cpu,
            mem: options.algorithms.templatesStore[a.name].mem
        }));
        algorithmQueue = orderBy(algorithmQueue, q => q.cpu);
        algorithmQueue.forEach(r => resourceAllocator.allocate(r.name));
        let results = resourceAllocator.results();
        results = queueUtils.normalize(options.algorithms.queue, results);
        return results;
    }
}

module.exports = TemplatesStoreMetric;
