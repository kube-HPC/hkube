const EventEmitter = require('events');
const pipelines = require('./pipelines');

class StateManagerMock extends EventEmitter {

    searchPipelines() {
        return pipelines;
    }
}

module.exports = new StateManagerMock();