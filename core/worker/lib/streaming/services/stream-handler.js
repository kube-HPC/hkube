const EventEmitter = require('events');
const streamService = require('./stream-service');
const discovery = require('./service-discovery');
const { streamingEvents } = require('../../consts');

class StreamHandler extends EventEmitter {
    async init(options) {
        await streamService.init(options);
        await discovery.init(options);

        discovery.on(streamingEvents.DISCOVERY_CHANGED, (changed) => {
            this.emit(streamingEvents.DISCOVERY_CHANGED, changed);
        });
        streamService.on(streamingEvents.PROGRESS_CHANGED, (changed) => {
            this.emit(streamingEvents.PROGRESS_CHANGED, changed);
        });
    }

    async start(options) {
        await streamService.start(options);
        await discovery.start(options);
    }

    async finish(options) {
        await streamService.finish(options);
        await discovery.finish(options);
    }

    reportStats(data) {
        streamService.reportStats(data);
    }
}

module.exports = new StreamHandler();
