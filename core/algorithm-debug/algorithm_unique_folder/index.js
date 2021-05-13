const { stateType } = require('@hkube/consts');
const EventEmitter = require('events');
const messages = require('@hkube/nodejs-wrapper/lib/consts/messages');
const codeApi = require('@hkube/nodejs-wrapper/lib/codeApi/codeApi');
const ws = require('../lib/algorithm-communication/ws');
const events = new EventEmitter();

const init = async (options, hkubeApi) => {
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    await ws.send({ command: messages.incoming.initialize, data: options });
};

const start = async (options, hkubeApi) => {
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    if (options.kind === 'stream') {
        if (options.stateType === stateType.Stateless) {
            await ws.send({ command: messages.incoming.start, data: options });
        }
        else {
            hkubeApi.registerInputListener((message, origin) => {
                ws.send({ command: messages.incoming.message, data: { message, origin } });
            });
            return new Promise((res, rej) => {
                this._resolve = res;
                this._reject = rej;
            });
        }
    }
    else {
        await ws.send({ command: messages.incoming.start, data: options });
    }
};

const stop = async () => {
    events.emit('stop');
};

module.exports = {
    start,
    stop,
    init
};
