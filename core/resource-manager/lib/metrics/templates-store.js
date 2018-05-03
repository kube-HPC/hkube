
const Metric = require('./Metric');
const orderBy = require('lodash.orderby');
const queueUtils = require('../utils/algorithm-queue');
const ResourceAllocator = require('../resources/resource-allocator');

class TemplatesStoreMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.settings.resourceThresholds, ...options });
        let algorithmQueue = queueUtils.order(options.algorithmQueue);
        algorithmQueue = algorithmQueue.map(a => ({
            ...a,
            cpu: options.templatesStore[a.name].cpu,
            mem: options.templatesStore[a.name].mem
        }));
        algorithmQueue = orderBy(algorithmQueue, q => q.cpu);
        algorithmQueue.forEach(r => resourceAllocator.allocate(r.name));
        let results = resourceAllocator.results();
        results = queueUtils.normalize(options.algorithmQueue, results);
        return results;
    }
}

module.exports = TemplatesStoreMetric;