// const trigger = require('./trigger');
const log = require('@hkube/logger').GetLogFromContainer();
const triggers = require('./triggers');
const triggerQueue = require('./trigger-queue');
const {componentName} = require('./consts/index');
class TriggerRunner {
    // constructor() {
    // }
        
    async init() {
        log.info('trigger runnuer initiated', { component: componentName.TRIGGER_RUNNER});
        await triggerQueue.init();
        Object.values(triggers).forEach(t => t.init());    
    }
}


module.exports = new TriggerRunner();
