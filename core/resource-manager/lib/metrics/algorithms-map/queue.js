const log = require('@hkube/logger').GetLogFromContainer();
const Metric = require('../Metric');
const queueUtils = require('../../utils/queue');
const ResourceAllocator = require('../../allocators/resource-allocator');
const component = require('../../consts/components').ALGORITHM_QUEUE;

class QueueMetric extends Metric {
    constructor(options) {
        super(options);
    }

    calc(options) {
        let results = Object.create(null);
        const queue = queueUtils.order(options.algorithms.queue);
        this._log(options.algorithms.queue);
        if (queue.length > 0) {
            const resourceAllocator = new ResourceAllocator({
                resourceThresholds: this.config.resourceThresholds.algorithms,
                resources: options.resources.k8s,
                templatesStore: options.algorithms.templatesStore
            });
            queue.forEach(r => resourceAllocator.allocate(r.name));
            results = resourceAllocator.results();
        }
        results = queueUtils.normalize(options.algorithms.queue, results);
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
