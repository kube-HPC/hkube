
const Metric = require('./Metric');
const orderBy = require('lodash.orderby');
const groupBy = require('lodash.groupby');
const resourceDecider = require('../resource-handlers/resource-decider');

class AlgorithmQueueMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const algorithmQueue = orderBy(options.algorithmQueue, q => q.score, 'desc');
        const data = {
            ...options,
            algorithmQueue
        }
        return resourceDecider.run(data);
    }
}

module.exports = AlgorithmQueueMetric;