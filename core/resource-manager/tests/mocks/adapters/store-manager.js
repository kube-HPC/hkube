const EventEmitter = require('events');
const clone = require('clone');
const algorithmQueue = require('../data/algorithm-queue.json');
const pipelinesQueue = require('../data/drivers-queue.json');
const storeTemplates = require('../data/templates-store.json');
const driversStore = require('../data/drivers-store.json');

class StateManagerMock extends EventEmitter {

    getAlgorithmQueue(options) {
        return clone(algorithmQueue);
    }

    getPipelineDriverQueue(options) {
        return clone(pipelinesQueue);
    }

    setPipelineDriverRequirements() {
    }

    getPipelineDriverTemplateStore(options) {
        return clone(driversStore);
    }

    getAlgorithmTemplateStore(options) {
        return clone(storeTemplates);
    }

    setAlgorithmsResourceRequirements() {
    }
}

module.exports = new StateManagerMock();