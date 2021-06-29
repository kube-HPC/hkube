const { stateType, pipelineKind } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const EventEmitter = require('events');
const { uid } = require('@hkube/uid');
const messages = require('@hkube/nodejs-wrapper/lib/consts/messages');
const debugMessages = require('./consts/messages');
const ws = require('./algorithm-communication/ws');
const events = new EventEmitter();
const sendMessageDelegates = {};

const init = async () => {
    log.info('In debug init');
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    this.prevMessageDone = null;
};
const start = async (options, hkubeApi) => {
    log.info('In debug start');
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    ws.removeAllListeners();
    ws.on(messages.outgoing.done, (value) => {
        return this._resolve(value);
    });
    ws.on(debugMessages.outgoing.streamingInMessageDone, ({ sendMessageId }) => {
        if (sendMessageId) {
            delete sendMessageDelegates[sendMessageId];
        }
        this._prevMsgResolve();
    });

    ws.on(messages.outgoing.startAlgorithmExecution, async ({ execId, algorithmName, input, includeResult }) => {
        const result = await hkubeApi.startAlgorithm(algorithmName, input, includeResult);
        ws.send({ command: messages.incoming.execAlgorithmDone, data: { execId, response: result } });
    });
    ws.on(messages.outgoing.startRawSubPipeline, async ({ subPipeline, subPipelineId, includeResult }) => {
        const result = await hkubeApi.startRawSubpipeline(subPipeline.name, subPipeline.nodes, subPipeline.options, subPipeline.webhooks, subPipeline.flowInput, includeResult);
        ws.send({ command: messages.incoming.subPipelineDone, data: { subPipelineId, response: result } });
    });
    ws.on(messages.outgoing.startStoredSubPipeline, async ({ subPipeline, subPipelineId, includeResult }) => {
        const result = await hkubeApi.startStoredSubpipeline(subPipeline.name, subPipeline.flatInput, includeResult);
        ws.send({ command: messages.incoming.subPipelineDone, data: { subPipelineId, response: result } });
    });

    ws.on('disconnect', () => {
        if (this.prevMessageDone) {
            this._prevMsgResolve();
        }
    });
    ws.on(debugMessages.outgoing.streamingOutMessage, ({ message, flowName, sendMessageId }) => {
        const sendMessage = sendMessageDelegates[sendMessageId];
        log.info(`sending a message, flow:${flowName}`);
        if (sendMessage) {
            sendMessage(message);
        }
        else {
            hkubeApi.sendMessage(message, flowName);
        }
    });
    const optionsCopy = { ...options, kind: pipelineKind.Batch, flatInput: null };
    ws.send({ command: messages.incoming.initialize, data: optionsCopy });
    ws.send({ command: messages.incoming.start, data: optionsCopy });
    if (options.kind === pipelineKind.Stream && options.stateType !== stateType.Stateless) {
        hkubeApi.registerInputListener(async ({ payload, origin, sendMessage }) => {
            if (this.prevMessageDone) {
                await this.prevMessageDone;
            }
            const sendMessageId = uid();
            sendMessageDelegates[sendMessageId] = sendMessage;
            ws.send({ command: debugMessages.incoming.streamingInMessage, data: { payload, origin, sendMessageId } });
            this.prevMessageDone = new Promise((res) => {
                this._prevMsgResolve = res;
            });
        });
        hkubeApi.startMessageListening();
        log.info('Finished starting handling stateful');
    }
    return new Promise((res, rej) => {
        this._resolve = res;
        this._reject = rej;
    });
};

const stop = async () => {
    log.info('In debug stop');
    events.emit('stop');
};

module.exports = {
    start,
    stop,
    init
};
