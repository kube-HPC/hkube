
const Metric = require('../Metric');
const orderBy = require('lodash.orderby');
const queueUtils = require('../../utils/queue');
const ResourceAllocator = require('../../resources/resource-allocator');

class TemplatesStoreMetric extends Metric {
    constructor(options, name) {
        super(options, name);
        this.weight = 0.1;
    }

    calc(options) {
        let results = Object.create(null);
        let queue = queueUtils.order(options.algorithms.queue);
        if (queue.length > 0) {
            const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.options.resourceThresholds.algorithms, ...options.algorithms });
            const ts = options.algorithms.templatesStore;
            queue = queue.map(a => ({ ...a, cpu: ts[a.name].cpu, mem: ts[a.name].mem }));
            queue = orderBy(queue, q => q.cpu);
            queue.forEach(r => resourceAllocator.allocate(r.name));
            results = resourceAllocator.results();
        }
        results = queueUtils.normalize(options.algorithms.queue, results);
        return results;
    }
}

module.exports = TemplatesStoreMetric;
