const orderBy = require('lodash.orderby');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').RESOURCE_DECIDER;

class ResourceDecider {
    init(options) {
        this._thresholdCpu = options.thresholds.cpu;
        this._thresholdMem = options.thresholds.mem;
    }

    run(data) {
        const results = [];
        const map = Object.create(null);
        let { totalCpu, totalMem } = this._totalResources(data.k8s);
        const algorithmQueue = orderBy(data.algorithmQueue, q => q.score, 'desc');
        for (let res of algorithmQueue) {
            const { cpu, mem } = data.templatesStore[res.alg] || {};
            if (!map[res.alg]) {
                map[res.alg] = { pods: 0 };
            }
            if (cpu <= totalCpu && mem <= totalMem) {
                totalCpu -= cpu;
                totalMem -= mem;
                map[res.alg].pods++;
            }
            if (totalCpu <= 0 || totalMem <= 0) {
                break;
            }
        }
        Object.entries(map).forEach(([k, v]) => {
            results.push({ alg: k, data: v });
        });
        return results;
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