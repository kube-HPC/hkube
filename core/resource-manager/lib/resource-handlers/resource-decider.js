const orderBy = require('lodash.orderby');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').RESOURCE_DECIDER;

class ResourceDecider {
    run(data) {
        const map = Object.create(null);
        try {
            let maxCpu = 0;
            let maxMem = 0;
            for (const [key, value] of data.k8s) {
                maxCpu += value.freeCpu;
                maxMem += value.freeMemory;
            }
            const algorithmQueue = orderBy(data.algorithmQueue, q => q.score, 'desc');
            for (let res of algorithmQueue) {
                const { cpu, mem } = data.templatesStore[res.alg];
                if (!map[res.alg]) {
                    map[res.alg] = { pods: 0 };
                }
                if (cpu <= maxCpu && mem <= maxMem) {
                    maxCpu -= cpu;
                    maxMem -= mem;
                    map[res.alg].pods++;
                }
                if (maxCpu === 0) {
                    break;
                }
            }
        }
        catch (error) {
            log.error(error.message, { component });
        }
        return map;
    }
}

module.exports = new ResourceDecider();