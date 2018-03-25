
const Metric = require('./Metric');
const orderBy = require('lodash.orderby');
const resourceDecider = require('../resource-handlers/resource-decider');

class TemplatesStoreMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        let algorithmQueue = options.algorithmQueue.map(a => ({
            ...a,
            cpu: options.templatesStore[a.alg].cpu,
            mem: options.templatesStore[a.alg].mem
        }));
        algorithmQueue = orderBy(algorithmQueue, q => q.cpu);

        const data = {
            ...options,
            algorithmQueue
        }
        return resourceDecider.run(data);
    }
}

module.exports = TemplatesStoreMetric;