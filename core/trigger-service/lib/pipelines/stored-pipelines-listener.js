const Events = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts/index');
const { prefix } = require('../consts/stored-pipeline-events');
const stateManager = require('../state/state-manager');
const Trigger = require('../triggers/Trigger');

class StoredPipelinesListener extends Events {
    init() {
        this._watch();
    }

    _watch() {
        stateManager.on(prefix.CHANGE, p => this.emit(prefix.CHANGE, new Trigger(p)));
        stateManager.on(prefix.DELETE, p => this.emit(prefix.DELETE, new Trigger(p)));
    }

    async getTriggeredPipelineByType(type) {
        let pipelines = [];
        try {
            pipelines = await stateManager.getPipelines(type);
            pipelines = pipelines.filter(p => p.triggers != null && p.triggers[type] != null).map(p => new Trigger(p));
        }
        catch (error) {
            log.error(`didn't received data from store error: ${error} `, { component: componentName.STORED_PIPELINES_LISTENER });
        }
        return pipelines;
    }
}

module.exports = new StoredPipelinesListener();
