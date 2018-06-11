
const Metric = require('../Metric');
const queueUtils = require('../../utils/pipeline-queue');
const ResourceAllocator = require('../../resources/resource-allocator');
const utils = require('../../utils/utils');

class QueueMetric extends Metric {
    constructor(options, name) {
        super(options, name);
        this.weight = 1;
    }

    calc(options) {
        const option = {
            resourceThresholds: this.options.resourceThresholds,
            k8s: options.algorithms.k8s,
            templatesStore: options.pipelines.templatesStore
        };
        const resourceAllocator = new ResourceAllocator(option);
        const queue = queueUtils.order(options.pipelines.queue, 'pipeline-driver');
        queue.forEach(r => resourceAllocator.allocate(r.name));
        let results = resourceAllocator.results();
        results = utils.mapToArray(results, ['name', 'data']);
        return results;
    }
}

module.exports = QueueMetric;
