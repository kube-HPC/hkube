const Metric = require('./Metric');
const utils = require('../utils/utils');
const AlgorithmRatios = require('../resources/ratios-allocator');
const ResourceAllocator = require('../resources/resource-allocator');

class PrometheusMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const allocations = utils.group(options.algorithmQueue.requests, 'name');
        const keys = Object.keys(allocations);
        const algorithms = options.prometheus.filter(p => keys.includes(p.algorithmName)).map(p => ({ name: p.algorithmName, value: p.runTime }));
        const algorithmRatios = new AlgorithmRatios({ algorithms, allocations });
        const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.settings.resourceThresholds, ...options });

        let algorithm = null;
        const algorithmGen = algorithmRatios.generateRandom();
        while (algorithm = algorithmGen.next().value) {
            resourceAllocator.allocate(algorithm.name);
        }

        const results = resourceAllocator.results();
        // console.log(JSON.stringify(results, null, 2));
        return results;
    }
}

module.exports = PrometheusMetric;