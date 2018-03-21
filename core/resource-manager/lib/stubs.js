const queue = require('../../tests/mocks/algorithm-queue.json');



class Stubs {
    async init() {
        await Promise.all(stub.map(a => stateManager.setQueueMetrics(a)));
        await Promise.all(stub.map(a => stateManager.setStoreTemplates(a)));
    }
}

module.exports = new Stubs();