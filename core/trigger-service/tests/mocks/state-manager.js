const EventEmitter = require('events');
const pipelines = require('./pipelines');

class StateManagerMock extends EventEmitter {

    getPipelines() {
        return pipelines;
    }
}

module.exports = new StateManagerMock();