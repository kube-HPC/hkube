const orderBy = require('lodash.orderby');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').RESOURCE_DECIDER;

class ResourceDecider {
    run(data) {
        const results = [];
        const map = Object.create(null);
        let totalCpu = 0;
        let totalMem = 0;
        let thresholdCpu = 0;
        let thresholdMem = 0;
        for (const [key, value] of data.k8s) {
            totalCpu += value.freeCpu;
            totalMem += value.freeMemory;
        }
        thresholdCpu = totalCpu * 0.8;
        thresholdMem = totalMem * 0.8;
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
}

module.exports = new ResourceDecider();