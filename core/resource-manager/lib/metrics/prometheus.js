const Metric = require('./Metric');
const utils = require('../utils/utils');
const queueUtils = require('../utils/algorithm-queue');
const AlgorithmRatios = require('../resources/ratios-allocator');
const ResourceAllocator = require('../resources/resource-allocator');

class PrometheusMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        let algorithmQueue = queueUtils.order(options.algorithmQueue);
        const allocations = utils.group(algorithmQueue, 'name');
        const keys = Object.keys(allocations);
        const algorithms = options.prometheus.filter(p => keys.includes(p.algorithmName)).map(p => ({ name: p.algorithmName, value: p.runTime }));
        const algorithmRatios = new AlgorithmRatios({ algorithms, allocations });
        const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.settings.resourceThresholds, ...options });

        let algorithm = null;
        const algorithmGen = algorithmRatios.generateRandom();
        while (algorithm = algorithmGen.next().value) {
            resourceAllocator.allocate(algorithm.name);
        }
        let results = resourceAllocator.results();
        results = queueUtils.normalize(options.algorithmQueue, results);
        return results;
    }
}

module.exports = PrometheusMetric;