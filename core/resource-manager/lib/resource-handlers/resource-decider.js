const ResourceCounter = require('./resource-counter');

class ResourceDecider {
    constructor(options) {
        this._totalCpu = 0;
        this._totalMem = 0;
        this._thresholdCpu = options.resourceThresholds.cpu;
        this._thresholdMem = options.resourceThresholds.mem;
        this._totalResources(data.k8s);
    }

    static run() {

    }

    get cpu() {

    }

    get mem() {

    }

    allocate(alg) {
        const resourceCounter = new ResourceCounter();
        const { cpu, mem } = data.templatesStore[alg] || {};
        if (cpu <= totalCpu && mem <= totalMem) {
            totalCpu -= cpu;
            totalMem -= mem;
            resourceCounter.inc(alg);
        }

        return resourceCounter.toArray();
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

module.exports = ResourceDecider;