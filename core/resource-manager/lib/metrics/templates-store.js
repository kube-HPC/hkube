
const Metric = require('./Metric');
const orderBy = require('lodash.orderby');
const ResourceAllocator = require('../resource-handlers/resource-allocator');

class TemplatesStoreMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const resourceAllocator = new ResourceAllocator(this.settings, options);
        let algorithmQueue = options.algorithmQueue.map(a => ({
            ...a,
            cpu: options.templatesStore[a.alg].cpu,
            mem: options.templatesStore[a.alg].mem
        }));
        algorithmQueue = orderBy(algorithmQueue, q => q.cpu);
        algorithmQueue.forEach(r => {
            resourceAllocator.allocate(r.alg);
        });
        const results = resourceAllocator.results();
        return results;
    }
}

module.exports = TemplatesStoreMetric;