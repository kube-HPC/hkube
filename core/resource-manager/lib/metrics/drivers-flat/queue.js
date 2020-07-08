const log = require('@hkube/logger').GetLogFromContainer();
const Metric = require('../Metric');
const queueUtils = require('../../utils/queue');
const component = require('../../consts/components').DRIVERS_QUEUE;

class QueueMetric extends Metric {
    constructor(options) {
        super(options);
    }

    calc(options) {
        const results = queueUtils.order(options.drivers.queue);
        this._log(options.drivers.queue);
        return results;
    }

    _log(queue) {
        const text = queue.map(q => `${q.data.length} ${q.name}`).sort().join(', ');
        if (text && text !== this._state) {
            log.debug(`requested queue: ${text}`, { component });
            this._state = text;
        }
    }
}

module.exports = QueueMetric;
