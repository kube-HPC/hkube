/**
 * 
 * @class ResourceAllocator
 */
class ResourceAllocator {
    constructor({ resourceThresholds, resources, templatesStore }) {
        this._totalCpu = 0;
        this._totalMem = 0;
        this._thresholdCpu = parseFloat(resourceThresholds.cpu);
        this._thresholdMem = parseFloat(resourceThresholds.mem);
        this._templatesStore = templatesStore;
        this._resourceCounter = Object.create(null);
        this._enable = false;
        this._totalResources(resources);
    }

    /**
     * The allocate method checks if there is sufficient cpu and memory
     * for specific resource, by comparing the resource requirements
     * against the the total available resources, if there is enough
     * resources it will increase the resource counter.
     * 
     * @param {any} resource 
     * 
     * @memberOf ResourceAllocator
     */
    allocate(resource) {
        if (this._enable) {
            const { cpu, mem } = this._templatesStore[resource];
            if (cpu <= this._totalCpu && mem <= this._totalMem) {
                this._totalCpu -= cpu;
                this._totalMem -= mem;
                this._count(resource);
            }
        }
        else {
            this._count(resource);
        }
    }

    _count(resource) {
        if (!this._resourceCounter[resource]) {
            this._resourceCounter[resource] = 0;
        }
        this._resourceCounter[resource] += 1;
    }

    /**
     * This method returns the required allocations for each resource
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
        return this._resourceCounter;
    }

    _totalResources(resources) {
        if (!resources) {
            return;
        }
        this._enable = false;
        let allocatableCpu = 0;
        let allocatableMemory = 0;
        let cpuRequests = 0;
        let memoryRequests = 0;

        resources.forEach(v => {
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
