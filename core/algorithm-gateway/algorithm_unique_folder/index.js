const EventEmitter = require('events');
const { InvalidDataError } = require('../lib/errors');
const events = new EventEmitter();
let props = {};

const start = async (options, hkubeApi) => {
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
        return this._resolve();
    });

    return new Promise((res, rej) => {
        this._resolve = res;
        this._reject = rej;
    });
};

const stop = async () => {
    props = {};
    events.emit('stop');
};

const jobData = () => {
    let data = null;
    if (props.data) {
        data = props.data;
    }
    return { data };
};

const streamMessage = (message, flow) => {
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
