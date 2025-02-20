const { stateType, pipelineKind } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const EventEmitter = require('events');
const { uid } = require('@hkube/uid');
const { messages } = require('@hkube/nodejs-wrapper');
const ws = require('./algorithm-communication/ws');
const events = new EventEmitter();
const sendMessageDelegates = {};

const init = async () => {
    log.throttle.info('In debug init');
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    this.prevMessageDone = null;
};
const restart = (options) => {
    ws.send({ command: messages.incoming.initialize, data: options });
    ws.send({ command: messages.incoming.start, data: options });
};
const start = async (options, hkubeApi) => {
    log.debug('In debug start');
    events.removeAllListeners();
    events.on('stop', () => {
        return this._resolve();
    });
    ws.removeAllListeners();
    ws.on(messages.outgoing.done, (value) => {
        return this._resolve(value);
    });
    ws.on(messages.outgoing.error, ({ error } = {}) => {
        return this._reject(error);
    });
    ws.on(messages.outgoing.streamingInMessageDone, ({ sendMessageId }) => {
        if (sendMessageId) {
            delete sendMessageDelegates[sendMessageId];
        }
        this._prevMsgResolve();
    });

    ws.on(messages.outgoing.startAlgorithmExecution, async ({ execId, algorithmName, input, includeResult }) => {
        try {
            const response = await hkubeApi.startAlgorithm(algorithmName, input, includeResult);
            ws.send({ command: messages.incoming.execAlgorithmDone, data: { execId, response } });
        }
        catch (e) {
            ws.send({ command: messages.incoming.execAlgorithmError, data: { execId, response: e.message || e } });
        }
    });
    ws.on(messages.outgoing.startRawSubPipeline, async ({ subPipeline, subPipelineId, includeResult }) => {
        try {
            const response = await hkubeApi.startRawSubpipeline(subPipeline.name, subPipeline.nodes, subPipeline.options, subPipeline.webhooks, subPipeline.flowInput, includeResult);
            ws.send({ command: messages.incoming.subPipelineDone, data: { subPipelineId, response } });
        }
        catch (e) {
            ws.send({ command: messages.incoming.subPipelineError, data: { subPipelineId, response: e.message || e } });
        }
    });
    ws.on(messages.outgoing.startStoredSubPipeline, async ({ subPipeline, subPipelineId, includeResult }) => {
        try {
            const response = await hkubeApi.startStoredSubpipeline(subPipeline.name, subPipeline.flowInput, includeResult);
            ws.send({ command: messages.incoming.subPipelineDone, data: { subPipelineId, response } });
        }
        catch (e) {
            ws.send({ command: messages.incoming.subPipelineError, data: { subPipelineId, response: e.message || e } });
        }
    });
    ws.on(messages.outgoing.dataSourceRequest, async ({ requestId, dataSource }) => {
        let response;
        let error;
        try {
            response = await hkubeApi.getDataSource(dataSource);
        }
        catch (e) {
            error = e.message || e;
        }
        ws.send({ command: messages.incoming.dataSourceResponse, data: { requestId, response, error } });
    });

    ws.on('disconnect', () => {
        if (this.prevMessageDone) {
            this._prevMsgResolve();
        }
    });
    ws.on(messages.outgoing.streamingOutMessage, ({ message, flowName, sendMessageId }) => {
        const sendMessage = sendMessageDelegates[sendMessageId];
        log.throttle.info(`sending a message, flow:${flowName}`);
        if (sendMessage) {
            sendMessage(message);
        }
        else {
            hkubeApi.sendMessage(message, flowName);
        }
    });
    ws.on(messages.outgoing.logData, (data) => {
        data.forEach((value) => {
            process.stdout.write(`${value}\n`);
        });
    });
    const optionsCopy = { ...options, kind: pipelineKind.Batch, flatInput: null };
    ws.on('connection', () => {
        restart(optionsCopy);
    });
    ws.send({ command: messages.incoming.initialize, data: optionsCopy });
    ws.send({ command: messages.incoming.start, data: optionsCopy });
    if (options.kind === pipelineKind.Stream && options.stateType !== stateType.Stateless) {
        hkubeApi.registerInputListener(async ({ payload, origin, sendMessage }) => {
            if (this.prevMessageDone) {
                await this.prevMessageDone;
            }
            const sendMessageId = uid();
            sendMessageDelegates[sendMessageId] = sendMessage;
            ws.send({ command: messages.incoming.streamingInMessage, data: { payload, origin, sendMessageId } });
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
    ws.removeListener('connection', restart);
};

module.exports = {
    start,
    stop,
    init
};
