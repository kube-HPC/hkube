const configIt = require('@hkube/config');
const { main: config } = configIt.load();
const { expect } = require('chai');
const messages = require('../lib/consts/messages')
const WebSocket = require('ws');
const app = require('../lib/app');
// const Logger = require('@hkube/logger');
// const log = new Logger('debugTest', logger);
const { Encoding } = require('@hkube/encoding');
const ws = require('../lib/algorithm-communication/ws');
const jobs = require('./jobs');


describe('Debug', () => {
    let combinedUrl;
    const encoding = new Encoding({ type: 'bson' });
    before(() => {
        combinedUrl = `ws://${config.debugger.communication.host}:${config.debugger.communication.port}?encoding=bson`;
    });
    it('streaming stateless init start', async () => {
        const socket = new WebSocket(combinedUrl, {});
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
        const socket = new WebSocket(combinedUrl, {});
        let resolveInit;
        let resolveStart;
        let resolveStartResult;
        let resolveMessage;
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

        socket.on('message', (data) => {
            const decodedData = encoding.decode(data);
            if (decodedData.command === 'initialize') {
                resolveInit();
            }
            if (decodedData.command === 'start') {
                resolveStart();
            }
            if (decodedData.command === 'message') {
                expect(decodedData.data.payload).to.eq('message2', 'stateful did not get the message')
                expect(decodedData.data.origin).to.eq('a', 'stateful did not get the origin')
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
        })
        await promiseInit;
        wrapper._start({});
        await promiseStart;
        wrapper._streamingManager._onMessage({ flowPattern: {}, payload: 'message2', origin: 'a' });
        await promiseMessage;
        socket.send(encoding.encode({ command: messages.outgoing.done, data: 'return value' }));
        await promiseStartResult;
        wrapper._stop({ forceStop: true });
    });
    it('batch init start', async () => {
        const socket = new WebSocket(combinedUrl, {});
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
        })
        await promiseInit;
        wrapper._start({});
        await promiseStart;
        socket.send(encoding.encode({ command: messages.outgoing.done, data: 'return value' }));
        await promiseStartResult;
        wrapper._stop({ forceStop: true });
    });
});