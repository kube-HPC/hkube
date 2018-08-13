const Metric = require('../Metric');
const { groupBy } = require('../../utils/utils');
const queueUtils = require('../../utils/queue');
const AlgorithmRatios = require('../../allocators/ratios-allocator');
const ResourceAllocator = require('../../allocators/resource-allocator');

class CpuUsageMetric extends Metric {
    constructor(options) {
        super(options);
    }

    calc(options) {
        const queue = queueUtils.order(options.algorithms.queue);

        const resourceAllocator = new ResourceAllocator({
            resourceThresholds: this.config.resourceThresholds.algorithms,
            resources: options.resources.k8s,
            templatesStore: options.algorithms.templatesStore
        });

        if (queue.length > 0 && options.algorithms.prometheus) {
            const allocations = groupBy(queue, 'name');
            const keys = Object.keys(allocations);
            const algorithms = options.algorithms.prometheus
                .filter(p => keys.includes(p.algorithmName))
                .map(p => ({ name: p.algorithmName, value: p.cpuUsage }));

            if (algorithms.length > 0) {
                const algorithmRatios = new AlgorithmRatios({ algorithms, allocations });
                let algorithm = null;
                const algorithmGen = algorithmRatios.generateRandom();
                while (algorithm = algorithmGen.next().value) {
                    resourceAllocator.allocate(algorithm.name);
                }
            }
            else {
                queue.forEach(r => resourceAllocator.allocate(r.name));
            }
        }
        else {
            queue.forEach(r => resourceAllocator.allocate(r.name));
        }
        const results = resourceAllocator.results();
        const result = queueUtils.normalize(options.algorithms.queue, results);
        return result;
    }
}

module.exports = CpuUsageMetric;
