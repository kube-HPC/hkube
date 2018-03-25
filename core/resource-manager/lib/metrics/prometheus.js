const groupBy = require('lodash.groupby');
const Metric = require('./Metric');
const Ratios = require('./ratios');
const ResourceAllocator = require('../resource-handlers/resource-allocator');

class PrometheusMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const algorithmQueue = groupBy(options.algorithmQueue, 'alg');
        const algorithms = Object.keys(algorithmQueue);
        const prometheus = options.prometheus.filter(p => algorithms.includes(p.algorithmName));
        const ratios = new Ratios({ ratios: prometheus, prop: 'runTime', group: algorithmQueue });
        const resourceAllocator = new ResourceAllocator(this.settings, options);

        let algorithm = null;
        let algorithmGen = ratios.generate();
        while (algorithm = algorithmGen.next().value) {
            resourceAllocator.allocate(algorithm.algorithmName);
        }

        const results = resourceAllocator.results();
        console.log(JSON.stringify(results, null, 2));
        return results;
    }
}

module.exports = PrometheusMetric;