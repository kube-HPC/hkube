const EventEmitter = require('events');
const { Events } = require('../consts');
const storeManager = require('../store/store-manager');
const Trigger = require('../triggers/Trigger');

class StoredPipelinesListener extends EventEmitter {
    init() {
        this._watch();
    }

    _watch() {
        storeManager.on(Events.CHANGE, p => this.emit(Events.CHANGE, new Trigger(p)));
        storeManager.on(Events.DELETE, p => this.emit(Events.DELETE, new Trigger(p)));
    }

    async getTriggeredPipelineByType(type) {
        let pipelines = [];
        pipelines = await storeManager.getPipelines();
        pipelines = pipelines.filter(p => p.triggers != null && p.triggers[type] != null).map(p => new Trigger(p));
        return pipelines;
    }
}

module.exports = new StoredPipelinesListener();
