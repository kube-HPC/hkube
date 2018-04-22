const EventEmitter = require('events');
const algorithmQueue = require('../data/algorithm-queue.json');
const storeTemplates = require('../data/templates-store.json');

class StateManager extends EventEmitter {

    getAlgorithmQueue(options) {
        return algorithmQueue;
    }

    getResourceRequirements(options) {
        return this._etcd.algorithms.resourceRequirements.list(options);
    }

    getStoreTemplates(options) {
        return storeTemplates;
    }

    setStoreTemplates(){
        
    }
}

module.exports = new StateManager();