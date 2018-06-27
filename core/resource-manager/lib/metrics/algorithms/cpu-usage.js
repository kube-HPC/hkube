const Metric = require('../Metric');
const { groupBy } = require('../../utils/utils');
const queueUtils = require('../../utils/queue');
const AlgorithmRatios = require('../../resources/ratios-allocator');
const ResourceAllocator = require('../../resources/resource-allocator');

class CpuUsageMetric extends Metric {
    constructor(options, name) {
        super(options, name);
        this.weight = 0.1;
    }

    calc(options) {
        const algorithmQueue = queueUtils.order(options.algorithms.queue);
        const allocations = groupBy(algorithmQueue, 'name');
        const keys = Object.keys(allocations);
        const algorithms = options.algorithms.prometheus.filter(p => keys.includes(p.algorithmName)).map(p => ({ name: p.algorithmName, value: p.cpuUsage }));
        const algorithmRatios = new AlgorithmRatios({ algorithms, allocations });
        const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.options.resourceThresholds.algorithms, ...options.algorithms });

        let algorithm = null;
        const algorithmGen = algorithmRatios.generateRandom();
        while (algorithm = algorithmGen.next().value) {
            resourceAllocator.allocate(algorithm.name);
        }
        const res = resourceAllocator.results();
        const results = queueUtils.normalize(options.algorithms.queue, res);
        return results;
    }
}

module.exports = CpuUsageMetric;
