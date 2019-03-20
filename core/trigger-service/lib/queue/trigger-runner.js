const triggers = require('../triggers');
const triggerQueue = require('./trigger-queue');

class TriggerRunner {
    async init(config) {
        await triggerQueue.init(config);
        await Promise.all(Object.values(triggers).map(t => t.init(config)));
    }
}

module.exports = new TriggerRunner();
