const ResourceCounter = require('./resource-counter');

class ResourceDecider {
    init(options) {
        this._thresholdCpu = options.resourceThresholds.cpu;
        this._thresholdMem = options.resourceThresholds.mem;
    }

    get hasCpu() {

    }

    get hasMem() {

    }

    run(data) {
        const resourceCounter = new ResourceCounter();
        let { totalCpu, totalMem } = this._totalResources(data.k8s);
        data.algorithmQueue.forEach(a => {
            const { cpu, mem } = data.templatesStore[a.alg] || {};
            if (cpu <= totalCpu && mem <= totalMem) {
                totalCpu -= cpu;
                totalMem -= mem;
                resourceCounter.inc(a.alg);
            }
        });
        return resourceCounter.toArray();
    }

    _totalResources(data) {
        let totalCpu = 0;
        let totalMem = 0;
        for (const [key, value] of data) {
            totalCpu += value.freeCpu;
            totalMem += value.freeMemory;
        }
        totalCpu = totalCpu * this._thresholdCpu;
        totalMem = totalMem * this._thresholdMem;
        return { totalCpu, totalMem };
    }
}

module.exports = ResourceDecider;