
const Metric = require('./Metric');
const orderBy = require('lodash.orderby');
const ResourceAllocator = require('../resources/resource-allocator');

class TemplatesStoreMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.settings.resourceThresholds, ...options });
        let algorithmQueue = options.algorithmQueue.requests.map(a => ({
            ...a,
            cpu: options.templatesStore[a.name].cpu,
            mem: options.templatesStore[a.name].mem
        }));
        algorithmQueue = orderBy(algorithmQueue, q => q.cpu);
        algorithmQueue.forEach(r => resourceAllocator.allocate(r.name));
        const results = resourceAllocator.results();
        return results;
    }
}

module.exports = TemplatesStoreMetric;