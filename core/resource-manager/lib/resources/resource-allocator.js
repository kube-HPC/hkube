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
        this._thresholdCpu = parseFloat(resourceThresholds.cpu);
        this._thresholdMem = parseFloat(resourceThresholds.mem);
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
        const { cpu, mem } = this._templatesStore[algorithm];
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
        return this._resourceCounter.results();
    }

    _totalResources(data) {
        let allocatableCpu = 0;
        let allocatableMemory = 0;
        let cpuRequests = 0;
        let memoryRequests = 0;

        data.forEach(v => {
            allocatableCpu += v.allocatableCpu;
            allocatableMemory += v.allocatableMemory;
            cpuRequests += v.cpuRequests;
            memoryRequests += v.memoryRequests;
        });
        this._totalCpu = (allocatableCpu * this._thresholdCpu) - cpuRequests;
        this._totalMem = (allocatableMemory * this._thresholdMem) - memoryRequests;
    }
}

module.exports = ResourceAllocator;
