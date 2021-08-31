const EventEmitter = require('events');
const log = require('@hkube/logger').GetLogFromContainer();
const { InvalidDataError } = require('./errors');
const events = new EventEmitter();
let props = {};

const start = async (options, hkubeApi) => {
    log.info('streaming gateway: entering start function');
    props = {
        hkubeApi,
        data: {
            jobId: options.jobId,
            defaultFlow: options.defaultFlow,
            parsedFlow: options.parsedFlow
        }
    };

    events.removeAllListeners();
    events.on('stop', () => {
        log.info('streaming gateway: exiting start function');
        return this._resolve();
    });

    return new Promise((res, rej) => {
        this._resolve = res;
        this._reject = rej;
    });
};

const stop = async () => {
    log.info('streaming gateway: entering stop function');
    props = {};
    events.emit('stop');
    log.info('streaming gateway: exiting stop function');
};

const _getStats = () => {
    let stats;
    try {
        // this underscore properties are need to be resolved
        const adapter = props.hkubeApi._streamingManager._messageProducer._adapter;
        const queueSize = adapter._messageQueue.queue.length;
        const queueMemoryBytes = adapter._messageQueue.sizeSum;
        const maxQueueMemoryBytes = adapter._maxMemorySize;

        stats = {
            queueSize,
            queueMemoryBytes,
            maxQueueMemoryBytes
        };
    }
    catch (e) {
        stats = `unable to get stats ${e.message}`;
    }
    return stats;
};

const jobData = () => {
    let data = null;
    if (props.data) {
        data = props.data;
        data.stats = _getStats();
        return data;
    }
    return { message: 'this algorithm is not active yet' };
};

const streamMessage = (message, flow) => {
    log.throttle.info('streaming gateway: got streamMessage');
    if (!props.data) {
        throw new InvalidDataError('this algorithm is not active yet');
    }
    try {
        let flowName = flow;
        if (!flowName) {
            flowName = props.data.defaultFlow;
        }
        props.hkubeApi.sendMessage(message, flowName);
    }
    catch (e) {
        throw new InvalidDataError(e.message);
    }
};

module.exports = {
    start,
    stop,
    jobData,
    streamMessage
};
