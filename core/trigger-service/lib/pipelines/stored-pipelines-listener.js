const EventEmitter = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName, Events } = require('../consts/index');
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
        try {
            pipelines = await storeManager.getPipelines();
            pipelines = pipelines.filter(p => p.triggers != null && p.triggers[type] != null).map(p => new Trigger(p));
        }
        catch (error) {
            log.error(`didn't received data from store error: ${error} `, { component: componentName.STORED_PIPELINES_LISTENER });
        }
        return pipelines;
    }
}

module.exports = new StoredPipelinesListener();
