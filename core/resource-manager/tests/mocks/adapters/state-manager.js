const algorithmQueue = require('../data/algorithm-queue.json');
const storeTemplates = require('../data/templates-store.json');

class StateManager {

    getAlgorithmQueue(options) {
        return algorithmQueue;
    }

    getResourceRequirements(options) {
        return this._etcd.algorithms.resourceRequirements.list(options);
    }

    getStoreTemplates(options) {
        return storeTemplates;
    }
}

module.exports = new StateManager();