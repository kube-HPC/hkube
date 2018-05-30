const Events = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts/index');
const { prefix } = require('../consts/stored-pipeline-events');
const storeManager = require('../store/store-manager');
const Trigger = require('../triggers/Trigger');

class StoredPipelinesListener extends Events {
    init() {
        this._watch();
    }

    _watch() {
        storeManager.on(prefix.CHANGE, p => this.emit(prefix.CHANGE, new Trigger(p)));
        storeManager.on(prefix.DELETE, p => this.emit(prefix.DELETE, new Trigger(p)));
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
