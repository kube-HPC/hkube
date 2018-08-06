
const log = require('@hkube/logger').GetLogFromContainer();
const Metric = require('../Metric');
const queueUtils = require('../../utils/queue');
const ResourceAllocator = require('../../resources/resource-allocator');
const component = require('../../consts/components').PIPELINES_QUEUE;

class QueueMetric extends Metric {
    constructor(options) {
        super(options);
    }

    calc(options) {
        let results = Object.create(null);
        const queue = queueUtils.order(options.pipelines.queue);
        this._log(options.pipelines.queue);
        if (queue.length > 0) {
            const resourceAllocator = new ResourceAllocator({
                resourceThresholds: this.config.resourceThresholds.pipelineDrivers,
                resources: options.resources.k8s,
                templatesStore: options.pipelines.templatesStore
            });
            queue.forEach(r => resourceAllocator.allocate(r.name));
            results = resourceAllocator.results();
        }
        results = queueUtils.normalize(options.pipelines.queue, results);
        return results;
    }

    _log(queue) {
        const text = queue.map(q => `${q.data.length + q.pendingAmount} ${q.name}`).sort().join(', ');
        if (text && text !== this._state) {
            log.debug(`requested queue: ${text}`, { component });
            this._state = text;
        }
    }
}

module.exports = QueueMetric;
