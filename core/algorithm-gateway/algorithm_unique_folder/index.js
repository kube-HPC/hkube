const EventEmitter = require('events');
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
    events.emit('stop');
};

const streamMessage = async (message, flowName) => {
    if (!props) {
        throw new Error('this pipeline is not active yet');
    }
    let flow = flowName;
    if (!flow) {
        flow = props.defaultFlow;
    }
    props.hkubeApi.sendMessage(message, flow);

}

module.exports = {
    start,
    stop,
    streamMessage
}
