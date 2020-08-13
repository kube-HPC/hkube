const EventEmitter = require('events');
const autoScaler = require('./auto-scaler');
const discovery = require('./service-discovery');
const { streamingEvents } = require('../consts');

class StreamHandler extends EventEmitter {
    async init(options) {
        await autoScaler.init(options);
        await discovery.init(options);

        discovery.on(streamingEvents.DISCOVERY_CHANGED, (changed) => {
            this.emit(streamingEvents.DISCOVERY_CHANGED, changed);
        });
        autoScaler.on(streamingEvents.PROGRESS_CHANGED, (changed) => {
            this.emit(streamingEvents.PROGRESS_CHANGED, changed);
        });
    }

    async start(options) {
        await autoScaler.start(options);
        await discovery.start(options);
    }

    async finish(options) {
        await autoScaler.finish(options);
        await discovery.finish(options);
    }

    reportStats(data) {
        autoScaler.reportStats(data);
    }
}

module.exports = new StreamHandler();
