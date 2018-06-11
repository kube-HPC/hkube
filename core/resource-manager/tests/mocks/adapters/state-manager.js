const EventEmitter = require('events');
const clone = require('clone');
const algorithmQueue = require('../data/algorithm-queue.json');
const pipelinesQueue = require('../data/pipelines-queue.json');
const storeTemplates = require('../data/templates-store.json');

class StateManagerMock extends EventEmitter {

    getAlgorithmQueue(options) {
        return clone(algorithmQueue);
    }

    getPipelineDriverQueue(options) {
        return clone(pipelinesQueue);
    }

    setPipelineDriverRequirements() {
    }

    getStoreTemplates(options) {
        return clone(storeTemplates);
    }

    setAlgorithmsResourceRequirements() {
    }
}

module.exports = new StateManagerMock();