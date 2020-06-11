const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const { pipelineStatuses } = require('@hkube/consts');
const messages = require('../lib/algorithm-communication/messages');
const jobConsumer = require('../lib/consumer/JobConsumer');
const { workerStates } = require('../lib/consts');
let subPipeline;
let workerCommunication;
let stateManager;

/*
 * code snipets for eval algorithm
 */

const doubleCode = [
    "function doDouble(input) {",
    "return 2 * input[0];",
    "}"
];

const longCode = [
    "async function delay(input) {",
    "await new Promise(resolve => setTimeout(resolve, 30000));",
    "console.log('code stopped')",
    "return input[0];",
    "}"
]


const gt10CondCode = [
    "function isGt10(input) {",
    "return (input[0] > 10);",
    "}"
];

/**
 * Create pipeline with one Eval algorithm
 * @param {string} name 
 * @param {Array} codeArray 
 * @param {object} subPipeline 
 */
function createOneAlgPipeline(name, codeArray) {
    if (codeArray.length === 0) {
        return;
    }
    let pipeline = {
        "name": name,
        "nodes": [
            {
                "nodeName": "noname",
                "algorithmName": "eval-alg",
                "input": ["@flowInput.data"],
                "extraData": {
                    "code": codeArray
                }
            }
        ],
        "options": {
            "batchTolerance": 100,
            "progressVerbosityLevel": "debug"
        },
        "webhooks": {
            "progress": "http://monitor-server:30010/webhook/progress",
            "result": "http://monitor-server:30010/webhook/result"
        }
    }
    return pipeline;
}

/**
 * Create algorithm data with eval code and 2 conditional sub pipelines (with condition expression code) .
 * Eval Algorithm flow for such data: 
 * 1. eval codeArray
 * 2. eval conditionCodeArray
 * 3. if true start single eval algorithm subpipeline with trueCodeArray
 * 4. else start single eval algorithm subpipeline with falseCodeArray
 * @param {*} input input for algorithm.
 * @param {Array} codeArray code for eval algorithm.
 * @param {Array} conditionCodeArray condition expression code
 * @param {Array} trueCodeArray code for sub pipeline single eval algorithm to perform when condition eval is true.
 * @param {Array} falseCodeArray code for sub pipeline single eval algorithm to perform when condition eval is false.
 */
function createAlgDataWithConditionalSubPipelines(input, codeArray, conditionCodeArray = [], trueCodeArray = [], falseCodeArray = []) {
    let algData = {
        'input': input,
        'info': {
            'extraData': {
                'code': codeArray
            }
        }
    }
    if (conditionCodeArray) {
        algData.info.extraData.conditionCode = conditionCodeArray;
        algData.info.extraData.trueSubPipeline = createOneAlgPipeline('trueSubPipeline', trueCodeArray);
        algData.info.extraData.falseSubPipeline = createOneAlgPipeline('falseSubPipeline', falseCodeArray);
    }
    return algData;
}

/**
 * This suite tests the worker subpipeline support (using algorunner mock).
 */
describe('worker SubPipeline test', () => {
    before(function () {
        this.timeout(5000);
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: false
        });
        mockery.registerSubstitute('./loopback', process.cwd() + '/test/mocks/algorunner-mock.js');
        mockery.registerSubstitute('../helpers/api-server-client', process.cwd() + '/test/mocks/api-server-mock.js');
        mockery.registerSubstitute('./states/stateManager', process.cwd() + '/test/mocks/stateManager.js');
        mockery.registerSubstitute('../states/stateManager', process.cwd() + '/test/mocks/stateManager.js'); // from subpipeline.js

        workerCommunication = require('../lib/algorithm-communication/workerCommunication');
        stateManager = require('./mocks/stateManager');
        subPipeline = require('../lib/code-api/subpipeline/subpipeline');
        if (jobConsumer._algTracer) {
            jobConsumer._algTracer._tracer.close();
        }
    });
    beforeEach(() => {
        sinon.restore();
        workerCommunication.removeAllListeners(messages.incomming.done);
        workerCommunication.removeAllListeners(messages.incomming.error);
        workerCommunication.removeAllListeners(messages.incomming.initialized);
    });
    after(async () => {
        mockery.disable();
    });
    it('stopping algorithm should stop subPipeline', function (done) {
        this.timeout(5000);
        const { adapter } = workerCommunication;
        const apiServerMock = require('./mocks/api-server-mock');
        const subPipelineHandler = require('../lib/code-api/subpipeline/subpipeline');
        const input = [10];
        workerCommunication.on(messages.incomming.initialized, (message) => {
            stateManager.state = workerStates.working;
            adapter.send({ command: messages.outgoing.start });
        });
        let algData = createAlgDataWithConditionalSubPipelines(input, doubleCode, gt10CondCode, longCode);
        adapter.send({ command: messages.outgoing.initialize, data: algData });
        setTimeout(() => {
            // stop pipeline
            const stateAdapter = require('../lib/states/stateAdapter');
            const subPipelineJobId = subPipelineHandler.getSubPipelineJobId('trueSubPipeline');
            stateAdapter.emit(pipelineStatuses.STOPPED, { jobId: jobConsumer.jobId, reason: 'test' });
            // ensure subPipeline was stopped
            expect(apiServerMock.isStopped(subPipelineJobId));
            done();
        }, 2000);
    });
    it('should return error required property subPipelineId on start subpipeline', async function () {
        const spy = sinon.spy(subPipeline, '_handleJobError');
        await subPipeline._handleStartSubPipeline({ data: null });
        const call = spy.getCalls()[0] || {};
        const args = call.args && call.args[0];
        expect(args).equals(`data should have required property 'subPipelineId'`);
    });
    it('enter should return error subPipelineId should be string on start subpipeline', async function () {
        const spy = sinon.spy(subPipeline, '_handleJobError');
        await subPipeline._handleStartSubPipeline({ data: { subPipelineId: 777 } });
        const call = spy.getCalls()[0] || {};
        const args = call.args && call.args[0];
        expect(args).equals('data.subPipelineId should be string');
    });
    it('should return error subPipeline should be object on start subpipeline', async function () {
        const spy = sinon.spy(subPipeline, '_handleJobError');
        await subPipeline._handleStartSubPipeline({ data: { subPipelineId: '777', subPipeline: null } });
        const call = spy.getCalls()[0] || {};
        const args = call.args && call.args[0];
        expect(args).equals('data.subPipeline should be object');
    });
    it('should return error required property subPipelineId on stop subpipeline', async function () {
        const spy = sinon.spy(subPipeline, '_handleJobError');
        await subPipeline._handleStopSubPipeline({ data: null });
        const call = spy.getCalls()[0] || {};
        const args = call.args && call.args[0];
        expect(args).equals(`data should have required property 'subPipelineId'`);
    });
    it('enter should return error subPipelineId should be string on stop subpipeline', async function () {
        const spy = sinon.spy(subPipeline, '_handleJobError');
        await subPipeline._handleStopSubPipeline({ data: { subPipelineId: 777 } });
        const call = spy.getCalls()[0] || {};
        const args = call.args && call.args[0];
        expect(args).equals('data.subPipelineId should be string');
    });
});
