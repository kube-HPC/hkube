const { stateType, pipelineKind } = require('@hkube/consts');
const Logger = require('@hkube/logger');
const EventEmitter = require('events');
const { uid } = require('@hkube/uid');
const messages = require('./consts/messages');
const ws = require('./algorithm-communication/ws');
const events = new EventEmitter();
const sendMessageDelegates = {};
const log = Logger.GetLogFromContainer();

const init = async () => {
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    this.prevMessageDone = null;
};
const start = async (options, hkubeApi) => { // eslint-disable-line consistent-return
    log.info('in start');
    log.info(`input:${options.input[0]}`);
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    ws.on(messages.outgoing.done, (value) => {
        return this._resolve(value);
    });
    ws.on(messages.outgoing.doneMessage, (sendMessageId) => {
        if (sendMessageId) {
            delete sendMessageDelegates[sendMessageId];
        }
        this._prevMsgResolve();
    });
    ws.on('disconnect', () => {
        if (this.prevMessageDone != null) {
            this._prevMsgResolve();
        }
    });
    ws.on(messages.outgoing.sendMessage, ({ message, flowName, sendMessageId }) => {
        const sendMessage = sendMessageDelegates[sendMessageId];
        if (flowName) {
            hkubeApi.sendMessage(message, flowName);
        }
        else if (sendMessage) {
            sendMessage(message);
        }
        else {
            hkubeApi.sendMessage(message);
        }
    });
    const optionsCopy = { ...options, kind: pipelineKind.Batch, flatInput: null };
    ws.send({ command: messages.incoming.initialize, data: optionsCopy });
    ws.send({ command: messages.incoming.start, data: optionsCopy });
    if (options.kind === pipelineKind.Stream) {
        if (options.stateType !== stateType.Stateless) {
            hkubeApi.registerInputListener(async ({ payload, origin, sendMessage }) => {
                if (this.prevMessageDone != null) {
                    await this.prevMessageDone;
                }
                const sendMessageId = uid();
                sendMessageDelegates[sendMessageId] = sendMessage;
                ws.send({ command: messages.incoming.message, data: { payload, origin, sendMessageId } });
                this.prevMessageDone = new Promise((res, rej) => {
                    this._prevMsgResolve = res;
                    this._prevMsgReject = rej;
                });
            });
            hkubeApi.startMessageListening();
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
