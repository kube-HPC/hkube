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
        let results = Object.create(null);
        const queue = queueUtils.order(options.algorithms.queue);
        if (queue.length > 0 && options.algorithms.prometheus) {
            const allocations = groupBy(queue, 'name');
            const keys = Object.keys(allocations);
            const algorithms = options.algorithms.prometheus.filter(p => keys.includes(p.algorithmName)).map(p => ({ name: p.algorithmName, value: p.cpuUsage }));
            const algorithmRatios = new AlgorithmRatios({ algorithms, allocations });
            const resourceAllocator = new ResourceAllocator({ resourceThresholds: this.options.resourceThresholds.algorithms, ...options.algorithms });

            let algorithm = null;
            const algorithmGen = algorithmRatios.generateRandom();
            while (algorithm = algorithmGen.next().value) {
                resourceAllocator.allocate(algorithm.name);
            }
            results = resourceAllocator.results();
        }
        results = queueUtils.normalize(options.algorithms.queue, results);
        return results;
    }
}

module.exports = CpuUsageMetric;
