const EventEmitter = require('events');
const clone = require('clone');
const algorithmQueue = require('../data/algorithm-queue.json');
const pipelinesQueue = require('../data/drivers-queue.json');
const storeTemplates = require('../data/templates-store.json');
const driversStore = require('../data/drivers-store.json');

class StateManagerMock extends EventEmitter {
    getAlgorithmQueue() {
        return clone(algorithmQueue);
    }

    getPipelineDriverQueue() {
        return clone(pipelinesQueue);
    }

    setPipelineDriverRequirements() {
    }

    getPipelineDriverTemplateStore() {
        return clone(driversStore);
    }

    getAlgorithmTemplateStore() {
        return clone(storeTemplates);
    }

    setAlgorithmsResourceRequirements() {
    }
}

module.exports = new StateManagerMock();