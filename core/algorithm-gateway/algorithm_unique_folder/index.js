const EventEmitter = require('events');
const InvalidDataError = require('../lib/validation/InvalidDataError');
const events = new EventEmitter();
let props;

const start = async (options, hkubeApi) => {
    props = {
        hkubeApi,
        defaultFlow: options.defaultFlow,
        parsedFlow: options.parsedFlow
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
    props = null;
    events.emit('stop');
};

const streamMessage = async (message, flowName) => {
    if (!props) {
        throw new InvalidDataError('this pipeline is not active yet');
    }
    let flow = flowName;
    if (!flow) {
        flow = props.defaultFlow;
    }
    try {
        props.hkubeApi.sendMessage(message, flow);
    }
    catch (e) {
        throw new InvalidDataError(e.message);
    }
};

module.exports = {
    start,
    stop,
    streamMessage
};
