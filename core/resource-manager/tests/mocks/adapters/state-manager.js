const EventEmitter = require('events');
const algorithmQueue = require('../data/algorithm-queue.json');
const storeTemplates = require('../data/templates-store.json');

class StateManagerMock extends EventEmitter {

    getAlgorithmQueue(options) {
        return algorithmQueue;
    }

    getResourceRequirements(options) {
        return this._etcd.algorithms.resourceRequirements.list(options);
    }

    getStoreTemplates(options) {
        return storeTemplates;
    }

    setResourceRequirements() {
    }
}

module.exports = new StateManagerMock();