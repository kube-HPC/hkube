const Metric = require('../Metric');
const { orderBy } = require('../../utils/utils');
const queueUtils = require('../../utils/queue');
const ResourceAllocator = require('../../allocators/resource-allocator');

class TemplatesStoreMetric extends Metric {
    constructor(options) {
        super(options);
    }

    calc(options) {
        let results = Object.create(null);
        let queue = queueUtils.order(options.algorithms.queue);
        if (queue.length > 0) {
            const resourceAllocator = new ResourceAllocator({
                resourceThresholds: this.config.resourceThresholds.algorithms,
                resources: options.resources.k8s,
                templatesStore: options.algorithms.templatesStore
            });
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
