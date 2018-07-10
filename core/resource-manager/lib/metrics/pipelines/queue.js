
const Metric = require('../Metric');
const queueUtils = require('../../utils/queue');
const ResourceAllocator = require('../../resources/resource-allocator');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../../common/consts/componentNames').PIPELINES_QUEUE;

class QueueMetric extends Metric {
    constructor(options, name) {
        super(options, name);
        this.weight = 1;
    }

    calc(options) {
        let results = Object.create(null);
        const queue = queueUtils.order(options.pipelines.queue);
        this._text(options.pipelines.queue);
        if (queue.length > 0) {
            const option = {
                resourceThresholds: this.options.resourceThresholds.pipelineDrivers,
                k8s: options.algorithms.k8s,
                templatesStore: options.pipelines.templatesStore
            };
            const resourceAllocator = new ResourceAllocator(option);
            queue.forEach(r => resourceAllocator.allocate(r.name));
            results = resourceAllocator.results();
        }
        results = queueUtils.normalize(options.pipelines.queue, results);
        return results;
    }

    _text(queue) {
        const text = queue.map(q => `${q.data.length + q.pendingAmount} ${q.name}`).sort().join(', ');
        if (text && text !== this._state) {
            log.debug(`requested queue: ${text}`, { component });
            this._state = text;
        }
    }
}

module.exports = QueueMetric;
