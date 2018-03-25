const ResourceCounter = require('./resource-counter');

class ResourceAllocator {
    constructor({ resourceThresholds }, { k8s, templatesStore }) {
        this._totalCpu = 0;
        this._totalMem = 0;
        this._thresholdCpu = resourceThresholds.cpu;
        this._thresholdMem = resourceThresholds.mem;
        this._templatesStore = templatesStore;
        this._resourceCounter = new ResourceCounter();
        this._totalResources(k8s);
    }

    allocate(alg) {
        const { cpu, mem } = this._templatesStore[alg] || {};
        if (cpu <= this._totalCpu && mem <= this._totalMem) {
            this._totalCpu -= cpu;
            this._totalMem -= mem;
            this._resourceCounter.inc(alg);
        }
    }

    results() {
        return this._resourceCounter.toArray();
    }

    _totalResources(data) {
        for (const [key, value] of data) {
            this._totalCpu += value.freeCpu;
            this._totalMem += value.freeMemory;
        }
        this._totalCpu = this._totalCpu * this._thresholdCpu;
        this._totalMem = this._totalMem * this._thresholdMem;
    }
}

module.exports = ResourceAllocator;