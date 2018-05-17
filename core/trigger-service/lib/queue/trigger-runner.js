const log = require('@hkube/logger').GetLogFromContainer();
const triggers = require('../triggers');
const triggerQueue = require('./trigger-queue');
const { componentName } = require('../consts/index');

class TriggerRunner {
    async init(config) {
        log.info('start initiating triggers', { component: componentName.TRIGGER_RUNNER });
        await triggerQueue.init(config);
        Object.values(triggers).forEach(t => t.init(config));
    }
}

module.exports = new TriggerRunner();
