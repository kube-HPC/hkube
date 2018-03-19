const adapterManager = require('../adapters/adapters-manager');
const metricsRunner = require('../metrics/metrics-runner');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;

class ResourceDecider {
    run(results) {
        let maxCpu;
        let maxMem;
        const resources = [];

        const map = Object.create(null);
        for (let res of results.algorithmQueue) {
            let { cpu, mem } = results.templatesStore[res.algorithmName];
            if (!map[res.algorithmName]) {
                map[res.algorithmName] = { pods: 0 };
            }
            if (cpu <= maxCpu && mem <= maxMem) {
                maxCpu -= cpu;
                maxMem -= mem;
                map[res.algorithmName].pods++;
            }
            if (maxCpu === 0) {
                break;
            }
        }
        return resources;
    }
}

module.exports = new ResourceDecider();