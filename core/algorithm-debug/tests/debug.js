const configIt = require('@hkube/config');
const { main: config } = configIt.load();
const { expect } = require('chai');
const { messages } = require('@hkube/nodejs-wrapper');
const WebSocket = require('ws');
let app;
// const Logger = require('@hkube/logger');
// const log = new Logger('debugTest', logger);
const { Encoding } = require('@hkube/encoding');
const ws = require('../lib/algorithm-communication/ws');
const jobs = require('./jobs');
let savedCallbacks = {}
const callbacksToSave=['_handleResponse', '_sendError'];

describe('Debug', () => {
    let combinedUrl;
    const encoding = new Encoding({ type: 'bson' });
    let socket;
    before(() => {
        app = require('../lib/app');
        combinedUrl = `ws://${config.debugger.communication.host}:${config.debugger.communication.port}?encoding=bson`;
    });
    beforeEach(async () => {
        if (socket) {
            socket.close();
        }
        ws.removeAllListeners();
        const sleep = d => new Promise(r => setTimeout(r, d));
        await sleep(2000)
        callbacksToSave.forEach(c=>savedCallbacks[c]=app.getWrapper()[c]);
    });
    afterEach(() => {
        callbacksToSave.forEach(c=>app.getWrapper()[c]=savedCallbacks[c]);
    });

    it('streaming stateless init start', async () => {
        socket = new WebSocket(combinedUrl, {});
        let resolveInit;
        let resolveStart;
        const promiseInit = new Promise((res, rej) => {
            resolveInit = res;

        });
        const promiseStart = new Promise((res, rej) => {
            resolveStart = res;
        });
        socket.on('message', (data) => {
            const decodedData = encoding.decode(data);
            if (decodedData.command === 'initialize') {
                resolveInit();
            }
            if (decodedData.command === 'start') {
                resolveStart();
            }
        })
        const wrapper = app.getWrapper();
        await wrapper._stop({});
        ws.on('connection', async () => {
            await wrapper._init(jobs.jobData);
            wrapper._start({});
        })
        const sleep = d => new Promise(r => setTimeout(r, d));
        await sleep(1000);
        wrapper._streamingManager._onMessage({ flowPattern: {}, payload: 'message1', origin: 'a' });
        await promiseInit;
        await promiseStart;
        wrapper._stop({ forceStop: true });
    });

    it('streaming stateful init start', async () => {
        socket = new WebSocket(combinedUrl, {});
        let resolveInit;
        let resolveStart;
        let resolveStartResult;
        let resolveMessage;
        let resolveMessageForwarded;
        const promiseInit = new Promise((res, rej) => {
            resolveInit = res;

        });
        const promiseStart = new Promise((res, rej) => {
            resolveStart = res;
        });
        const promiseStartResult = new Promise((res, rej) => {
            resolveStartResult = res;
        });
        const promiseMessage = new Promise((res, rej) => {
            resolveMessage = res;
        });
        const promiseMessageForwarded = new Promise((res, rej) => {
            resolveMessageForwarded = res;
        });
        let sendMessageId;
        socket.on('message', (data) => {
            const decodedData = encoding.decode(data);
            if (decodedData.command === 'initialize') {
                resolveInit();
            }
            if (decodedData.command === 'start') {
                resolveStart();
            }
            if (decodedData.command === messages.incoming.streamingInMessage) {
                expect(decodedData.data.payload).to.eq('message2', 'stateful did not get the message')
                expect(decodedData.data.origin).to.eq('a', 'stateful did not get the origin')
                sendMessageId = decodedData.data.sendMessageId;
                resolveMessage();
            }
        })
        const wrapper = app.getWrapper();
        wrapper._handleResponse = (algorithmData) => {
            expect(algorithmData).to.eq('return value', 'wrong return value');
            resolveStartResult()

        }
        await wrapper._stop({});
        ws.on('connection', async () => {
            wrapper._init(jobs.jobDataStateful);
            wrapper._start({});
        })


        await promiseInit;
        await promiseStart;


        const originalSendMessage = wrapper._streamingManager.sendMessage;
        wrapper._streamingManager.sendMessage = ({ message, flowPattern }) => {
            expect(flowPattern[0].source).to.eq('nodeName1');
            wrapper._streamingManager.sendMessage = originalSendMessage;
            wrapper._streamingManager.sendMessage(message, flowPattern);
            resolveMessageForwarded();
        }


        wrapper._streamingManager._onMessage({
            flowPattern: [{
                source: 'nodeName1',
                next: ['nextNode2']
            }], payload: 'message2', origin: 'a'
        });
        await promiseMessage;

        socket.send(encoding.encode({ command: messages.outgoing.streamingOutMessage, data: { message: 'myMessage', sendMessageId } }))

        await promiseMessageForwarded;
        socket.send(encoding.encode({ command: messages.outgoing.done, data: 'return value' }));
        await promiseStartResult;
        wrapper._stop({ forceStop: true });
    });

    it('hkube api start algorithm', async () => {
        socket = new WebSocket(combinedUrl, {});
        let resolveInit;
        let resolveStart;
        let resolveAlgorithmStartErr;
        let resolveAlgorithmStart;
        const promiseInit = new Promise((res, rej) => {
            resolveInit = res;
        });
        const promiseStart = new Promise((res, rej) => {
            resolveStart = res;
        });
        const promiseAlgorithmStartErr = new Promise((res, rej) => {
            resolveAlgorithmStartErr = res;
        });
        const promiseAlgorithmStart = new Promise((res, rej) => {
            resolveAlgorithmStart = res;
        });
        socket.on('message', (data) => {
            const decodedData = encoding.decode(data);
            if (decodedData.command === 'initialize') {
                resolveInit();
            }
            if (decodedData.command === 'start') {
                resolveStart();
            }
            if (decodedData.command === messages.incoming.execAlgorithmError) {
                expect(decodedData.data.execId).to.eq('execId', 'missing exeId')
                resolveAlgorithmStartErr();
            }
            if (decodedData.command === messages.incoming.execAlgorithmDone) {
                resolveAlgorithmStart();
            }
        })
        const wrapper = app.getWrapper();
        await wrapper._stop({});
        ws.on('connection', async () => {
            wrapper._init(jobs.jobDataStateful);
            wrapper._start({});
        })


        await promiseInit;
        await promiseStart;
        const originalStartAlgorithm = wrapper._hkubeApi.startAlgorithm
        wrapper._hkubeApi.startAlgorithm = () => {
            wrapper._hkubeApi.startAlgorithm = originalStartAlgorithm;
            throw 'myError';
        }
        socket.send(encoding.encode({
            command: messages.outgoing.startAlgorithmExecution, data: {
                execId: 'execId',
                algorithmName: 'algName',
                storageInput: 'storageInput',
                storage: 'storage',
                includeResult: true
            }
        }));

        await promiseAlgorithmStartErr;
        wrapper._hkubeApi.startAlgorithm = () => {
            wrapper._hkubeApi.startAlgorithm = originalStartAlgorithm;
            return "StartAlgorithmExecutionDone";
        }
        socket.send(encoding.encode({
            command: messages.outgoing.startAlgorithmExecution, data: {
                execId: 'execId',
                algorithmName: 'algName',
                storageInput: 'storageInput',
                storage: 'storage',
                includeResult: true
            }
        }));
        await promiseAlgorithmStart;
        wrapper._stop({ forceStop: true });
    });

    it('hkube api start sub pipeline', async () => {
        socket = new WebSocket(combinedUrl, {});
        let resolveInit;
        let resolveStart;
        let resolveSubStartErr;
        let resolveSubStart;
        const promiseInit = new Promise((res, rej) => {
            resolveInit = res;
        });
        const promiseStart = new Promise((res, rej) => {
            resolveStart = res;
        });
        const promiseAlgorithmStartErr = new Promise((res, rej) => {
            resolveSubStartErr = res;
        });
        const promiseSubpipe = new Promise((res, rej) => {
            resolveSubStart = res;
        });
        socket.on('message', (data) => {
            const decodedData = encoding.decode(data);
            if (decodedData.command === 'initialize') {
                resolveInit();
            }
            if (decodedData.command === 'start') {
                resolveStart();
            }
            if (decodedData.command === messages.incoming.subPipelineError) {
                expect(decodedData.data.subPipelineId).to.eq('subPipelineId', 'missing subPipelineId')
                resolveSubStartErr();
            }
            if (decodedData.command === messages.incoming.subPipelineDone) {
                resolveSubStart();
            }
        })
        const wrapper = app.getWrapper();
        await wrapper._stop({});
        ws.on('connection', async () => {
            wrapper._init(jobs.jobDataStateful);
            wrapper._start({});
        })


        await promiseInit;
        await promiseStart;
        const originalStartAlgorithm = wrapper._hkubeApi.startStoredSubPipeline
        wrapper._hkubeApi.startStoredSubpipeline = () => {
            wrapper._hkubeApi.startStoredSubPipeline = originalStartAlgorithm;
            throw "myErro";
        }
        socket.send(encoding.encode({
            command: messages.outgoing.startStoredSubPipeline, data: {
                subPipeline: {
                    name: 'storedName',
                    flowInput: {}
                },
                subPipelineId: 'subPipelineId',
                includeResult: true
            }
        }));

        await promiseAlgorithmStartErr;
        wrapper._hkubeApi.startStoredSubpipeline = () => {
            wrapper._hkubeApi.startStoredSubPipeline = originalStartAlgorithm;
            return "StartAlgorithmExecutionDone";
        }
        socket.send(encoding.encode({
            command: messages.outgoing.startStoredSubPipeline, data: {
                subPipeline: {
                    name: 'storedName',
                    flowInput: {}
                },
                subPipelineId: 'subPipelineId',
                includeResult: true
            }
        }));
        await promiseSubpipe;

        wrapper._stop({ forceStop: true });
    });

    it('hkube api datasource', async () => {
        socket = new WebSocket(combinedUrl, {});
        let resolveInit;
        let resolveStart;

        let resolveDataSourceErr;
        let resolveDatasource;
        const promiseInit = new Promise((res, rej) => {
            resolveInit = res;
        });
        const promiseStart = new Promise((res, rej) => {
            resolveStart = res;
        });
        const promiseDataSourceErr = new Promise((res, rej) => {
            resolveDataSourceErr = res;
        });
        const promiseDataSource = new Promise((res, rej) => {
            resolveDatasource = res;
        });
        socket.on('message', (data) => {
            const decodedData = encoding.decode(data);
            if (decodedData.command === 'initialize') {
                resolveInit();
            }
            if (decodedData.command === 'start') {
                resolveStart();
            }
            if (decodedData.command === messages.incoming.dataSourceResponse) {
                if (decodedData.data.error) {
                    expect(decodedData.data.requestId).to.eq('requestId', 'missing requestId')
                    resolveDataSourceErr();
                }
            }
            if (decodedData.command === messages.incoming.dataSourceResponse) {
                if (!decodedData.data.error) {
                    resolveDatasource();
                }
            }
        })
        const wrapper = app.getWrapper();
        await wrapper._stop({});
        ws.on('connection', async () => {
            wrapper._init(jobs.jobDataStateful);
            wrapper._start({});
        })


        await promiseInit;
        await promiseStart;
        const originalGetDataSource = wrapper._hkubeApi.getDataSource
        wrapper._hkubeApi.getDataSource = () => {
            wrapper._hkubeApi.getDataSource = originalGetDataSource;
            throw "myError";
        }
        socket.send(encoding.encode({
            command: messages.outgoing.dataSourceRequest, data: {
                requestId: "requestId",
                dataSource: "dsName"
            }
        }));

        await promiseDataSourceErr;
        wrapper._hkubeApi.getDataSource = () => {
            wrapper._hkubeApi.getDataSource = originalGetDataSource;
            return "dataSourceName";
        }
        socket.send(encoding.encode({
            command: messages.outgoing.dataSourceRequest, data: {
                requestId: "requestId",
                dataSource: "dsName"
            }
        }));
        await promiseDataSource;

        wrapper._stop({ forceStop: true });
    });

    it('batch init start', async () => {
        socket = new WebSocket(combinedUrl, {});
        let resolveInit;
        let resolveStart;
        let resolveStartResult;
        const promiseInit = new Promise((res, rej) => {
            resolveInit = res;
        });
        const promiseStart = new Promise((res, rej) => {
            resolveStart = res;
        });
        const promiseStartResult = new Promise((res, rej) => {
            resolveStartResult = res;
        });
        socket.on('message', (data) => {
            const decodedData = encoding.decode(data);
            if (decodedData.command === 'initialize') {
                resolveInit();
            }
            if (decodedData.command === 'start') {
                resolveStart();
            }
        })
        const wrapper = app.getWrapper();
        wrapper._handleResponse = (algorithmData) => {
            expect(algorithmData).to.eq('return value', 'wrong return value');
            resolveStartResult()

        }
        await wrapper._stop({});
        ws.on('connection', async () => {
            await wrapper._init(jobs.jobDataBatch);
            wrapper._start(jobs.jobDataBatch);
        });
        await promiseInit;
        await promiseStart;
        socket.send(encoding.encode({ command: messages.outgoing.done, data: 'return value' }));
        await promiseStartResult;
        wrapper._stop({ forceStop: true });
    });
    
    it('should handle algorithm error', async () => {
        socket = new WebSocket(combinedUrl, {});
        let resolveInit;
        let resolveStart;
        let resolveStartResult;
        const promiseInit = new Promise((res, rej) => {
            resolveInit = res;
        });
        const promiseStart = new Promise((res, rej) => {
            resolveStart = res;
        });
        const promiseStartResult = new Promise((res, rej) => {
            resolveStartResult = res;
        });
        socket.on('message', (data) => {
            const decodedData = encoding.decode(data);
            if (decodedData.command === 'initialize') {
                resolveInit();
            }
            if (decodedData.command === 'start') {
                resolveStart();
            }
        })
        const wrapper = app.getWrapper();
        let handlerResponse = null;
        wrapper._sendError = (error) => {
            handlerResponse = error;
            resolveStartResult()

        }
        await wrapper._stop({});
        ws.on('connection', async () => {
            await wrapper._init(jobs.jobDataBatch);
            wrapper._start(jobs.jobDataBatch);
        });
        await promiseInit;
        await promiseStart;
        socket.send(encoding.encode({ command: messages.outgoing.error, error: 'this failed' }));
        await promiseStartResult;
        expect(handlerResponse).to.eq('this failed');
        wrapper._stop({ forceStop: true });
    });

    it('connect twice', async () => {
        socket = new WebSocket(combinedUrl, {});
        const socket2 = new WebSocket(combinedUrl, {});
        let resolveGotAlreadyConnected;
        const gotConnectedAlready = new Promise((res, rej) => {
            resolveGotAlreadyConnected = res;
        });

        socket2.on("close", (code) => {
            if (code == 1013) {
                resolveGotAlreadyConnected();
            }
        })
        await gotConnectedAlready;
    });
});