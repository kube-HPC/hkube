const EventEmitter = require('events');
const streamService = require('./stream-service');
const discovery = require('./service-discovery');
const { streamingEvents } = require('../../consts');
const stateAdapter = require('../../states/stateAdapter');

/**
 * This class is the main and only point for
 * communicate with the streaming module.
 */
class StreamHandler extends EventEmitter {
    constructor() {
        super();
        this._isMinStateless = null;
    }

    async init(options) {
        await streamService.init(options);
        await discovery.init(options);

        discovery.on(streamingEvents.DISCOVERY_CHANGED, (changed) => {
            this.emit(streamingEvents.DISCOVERY_CHANGED, changed);
        });
        discovery.on(streamingEvents.DISCOVERY_PARENTS_DOWN, (changed) => {
            if (!this._isMinStateless) {
                this.emit(streamingEvents.DISCOVERY_PARENTS_DOWN, changed);
            }
        });
        streamService.on(streamingEvents.METRICS_CHANGED, (changed) => {
            this.emit(streamingEvents.METRICS_CHANGED, changed);
        });
    }

    async start(options) {
        const { jobId } = options;
        const pipeline = await stateAdapter.getJobPipeline({ jobId });
        const currentNode = pipeline.nodes.find(n => n.nodeName === options.nodeName);
        this._isMinStateless = currentNode?.minStatelessCount > 0;
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

    get isMaster() {
        return streamService.isMaster;
    }
}

module.exports = new StreamHandler();
