const { stateType } = require('@hkube/consts');
const EventEmitter = require('events');
const messages = require('@hkube/nodejs-wrapper/lib/consts/messages');
const ws = require('./algorithm-communication/ws');
const events = new EventEmitter();

const init = async (options) => {
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    ws.send({ command: messages.incoming.initialize, data: options });
};

const start = async (options, hkubeApi) => { // eslint-disable-line consistent-return
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    ws.on('return', (value) => {
        return this._resolve(value);
    });
    ws.send({ command: messages.incoming.start, data: options });
    if (options.kind === 'stream') {
        if (options.stateType !== stateType.Stateless) {
            hkubeApi.registerInputListener((message, origin) => {
                ws.send({ command: 'message', data: { message, origin } });
            });
        }
    }
    return new Promise((res, rej) => {
        this._resolve = res;
        this._reject = rej;
    });
};

const stop = async () => {
    events.emit('stop');
};

module.exports = {
    start,
    stop,
    init
};
