const ResourceCounter = require('./resource-counter');

/**
 * 
 * 
 * @class ResourceAllocator
 */
class ResourceAllocator {
    constructor({ resourceThresholds, k8s, templatesStore }) {
        this._totalCpu = 0;
        this._totalMem = 0;
        this._thresholdCpu = resourceThresholds.cpu;
        this._thresholdMem = resourceThresholds.mem;
        this._templatesStore = templatesStore;
        this._resourceCounter = new ResourceCounter();
        this._totalResources(k8s);
    }

    /**
     * The allocate method checks if there is sufficient cpu and memory
     * for specific algorithm, by comparing the algorithm requirements
     * against the the total available resources, if there is enough
     * resources it will increase the algorithm resource counter.
     * 
     * @param {any} algorithm 
     * 
     * @memberOf ResourceAllocator
     */
    allocate(algorithm) {
        const { cpu, mem } = this._templatesStore[algorithm] || {};
        if (cpu <= this._totalCpu && mem <= this._totalMem) {
            this._totalCpu -= cpu;
            this._totalMem -= mem;
            this._resourceCounter.inc(algorithm);
        }
    }

    /**
     * This method returns the required allocations for each algorithm
     * @example
     * results
     * Array <Object>
     * Object {
     *    name: "black-alg", 
     *    data: 20
     * }
     * @returns 
     * 
     * @memberOf ResourceAllocator
     */
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