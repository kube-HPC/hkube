const ResourceCounter = require('./resource-counter');

class ResourceDecider {
    init(options) {
        this._thresholdCpu = options.thresholds.cpu;
        this._thresholdMem = options.thresholds.mem;
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

module.exports = new ResourceDecider();