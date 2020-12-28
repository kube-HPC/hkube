const { expect } = require('chai');
const sinon = require('sinon');
const delay = require('delay');
const { uuid } = require('@hkube/uid');
const execAlgorithm = require('../lib/code-api/algorithm-execution/algorithm-execution');
const jobConsumer = require('../lib/consumer/JobConsumer');
const stateAdapter = require('../lib/states/stateAdapter');

describe('AlgorithmExecutions', () => {
    let spy;
    before(async () => {
        let options = { name: 'black-alg', data: 'bla' };
        await stateAdapter.createAlgorithmType(options);
    });
    after(async () => {
        let options = { name: 'black-alg', data: 'bla' };
        await stateAdapter.deleteAlgorithmType(options);
    });
    afterEach(() => {
        spy && spy.restore();
        execAlgorithm._watching = false;
        execAlgorithm._executions.clear();
    });
    it('should cache algorithm list', async () => {
        const algsBefore = await stateAdapter.getExistingAlgorithms();
        let options = { name: 'alg' + uuid(), data: 'bla' };
        await stateAdapter.createAlgorithmType(options);
        const algsAfter = await stateAdapter.getExistingAlgorithms();
        expect(algsAfter).to.deep.eql(algsBefore);
    });
    it('should cache algorithm list when called in rapid succession', async () => {
        const results = await Promise.all(Array.from(Array(30)).map(stateAdapter.getExistingAlgorithms));
        expect(results).to.have.lengthOf(30)
    });
    it('should fail with no execId', async function () {
        spy = sinon.spy(execAlgorithm, '_sendErrorToAlgorithm');
        await execAlgorithm._startAlgorithmExecution(null);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.error).equals(`data should have required property 'execId'`);
    });
    it('should fail with invalid type execId', async function () {
        const data = {
            execId: {}
        }
        spy = sinon.spy(execAlgorithm, '_sendErrorToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.error).equals('data.execId should be string');
    });
    it('should fail with invalid format execId', async function () {
        const data = {
            execId: '',
            algorithmName: 'alg'
        }
        spy = sinon.spy(execAlgorithm, '_sendErrorToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.error).equals('data.execId should NOT be shorter than 1 characters');
    });
    it('should fail with invalid type algorithmName', async function () {
        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: {}
        }
        spy = sinon.spy(execAlgorithm, '_sendErrorToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.error).equals('data.algorithmName should be string');
    });
    it('should fail with invalid format algorithmName', async function () {
        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: null
        }
        spy = sinon.spy(execAlgorithm, '_sendErrorToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.error).equals('data.algorithmName should be string');
    });
    it('should fail with execution cannot start in this state', async function () {
        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: 'black-alg',
            input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
        }
        spy = sinon.spy(execAlgorithm, '_sendErrorToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.execId).equals(data.execId);
        expect(args.error).equals('execution cannot start in this state');
    });
    it('should fail executing none existing algorithm', async function () {
        spy = sinon.spy(execAlgorithm, '_sendErrorToAlgorithm');
        const jobData = {
            jobId: `job-${uuid()}`,
            nodeName: 'white',
            pipelineName: 'pipeline-exec',
            priority: 3,
            algorithmName: 'white-alg',
            info: {
                extraData: null,
                lastRunResult: null
            }
        };
        jobConsumer._job = { data: jobData };

        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: 'stam-alg',
            input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
        };
        await execAlgorithm._startAlgorithmExecution({ data });
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('error');
        expect(args.error).equals(`Algorithm named 'stam-alg' does not exist`);
    });
    it('should fail with execution already running', async function () {
        const jobData = {
            jobId: `job-${uuid()}`,
            nodeName: 'white',
            pipelineName: 'pipeline-exec',
            priority: 3,
            algorithmName: 'white-alg',
            info: {
                extraData: null,
                lastRunResult: null
            }
        };
        jobConsumer._job = { data: jobData };

        const data = {
            execId: `same_execId`,
            algorithmName: 'black-alg',
            input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
        };
        spy = sinon.spy(execAlgorithm, '_sendErrorToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        await execAlgorithm._startAlgorithmExecution({ data });

        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.execId).equals(data.execId);
        expect(args.error).equals(`execution ${data.execId} already running`);
    });
    it('should succeed to create job', async function () {
        const jobData = {
            jobId: `job-${uuid()}`,
            nodeName: 'white',
            pipelineName: 'pipeline-exec',
            priority: 3,
            algorithmName: 'white-alg',
            info: {
                extraData: null,
                lastRunResult: null
            }
        };
        jobConsumer._job = { data: jobData };

        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: 'black-alg',
            input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
        };
        spy = sinon.spy(execAlgorithm, '_createJob');
        await execAlgorithm._startAlgorithmExecution({ data });

        const args = spy.getCalls()[0].args[0];
        expect(args.tasks[0]).to.have.property('execId');
        expect(args.tasks[0]).to.have.property('input');
        expect(args.tasks[0]).to.have.property('storage');
        expect(args.tasks[0]).to.have.property('taskId');
        expect(args.tasks[0].execId).equals(data.execId);
    });
    it('should succeed to send succeed status to algorithm', async function () {
        const jobData = {
            jobId: `job-${uuid()}`,
            nodeName: 'white',
            pipelineName: 'pipeline-exec',
            priority: 3,
            algorithmName: 'white-alg',
            info: {
                extraData: null,
                lastRunResult: null
            }
        };
        jobConsumer._job = { data: jobData };

        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: 'black-alg',
            input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
        };
        spy = sinon.spy(execAlgorithm, '_sendCompleteToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const execution = execAlgorithm._findTaskByExecId(data.execId);
        const task = {
            jobId: jobData.jobId,
            taskId: execution.taskId,
            status: 'succeed',
            execId: data.execId
        }
        await stateAdapter.updateTask(task);
        await delay(500);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('command');
        expect(args).to.have.property('execId');
        expect(args).to.have.property('response');
        expect(args.execId).equals(task.execId);
    });
    it('should succeed to send failed status to algorithm', async function () {
        const jobData = {
            jobId: `job-${uuid()}`,
            nodeName: 'white',
            pipelineName: 'pipeline-exec',
            priority: 3,
            algorithmName: 'white-alg',
            info: {
                extraData: null,
                lastRunResult: null
            }
        };
        jobConsumer._job = { data: jobData };

        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: 'black-alg',
            input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
        };
        spy = sinon.spy(execAlgorithm, '_sendCompleteToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const execution = execAlgorithm._findTaskByExecId(data.execId);
        const task = {
            jobId: jobData.jobId,
            taskId: execution.taskId,
            status: 'failed',
            execId: data.execId
        }
        await stateAdapter.updateTask(task);
        await delay(500);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('command');
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.execId).equals(task.execId);
    });
    it('should succeed to send stalled status to algorithm', async function () {
        const jobData = {
            jobId: `job-${uuid()}`,
            nodeName: 'white',
            pipelineName: 'pipeline-exec',
            priority: 3,
            algorithmName: 'white-alg',
            info: {
                extraData: null,
                lastRunResult: null
            }
        };
        jobConsumer._job = { data: jobData };

        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: 'black-alg',
            input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
        };
        spy = sinon.spy(execAlgorithm, '_sendCompleteToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const execution = execAlgorithm._findTaskByExecId(data.execId);
        const task = {
            jobId: jobData.jobId,
            taskId: execution.taskId,
            status: 'stalled',
            execId: data.execId
        }
        await stateAdapter.updateTask(task);
        await delay(500);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('command');
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.execId).equals(task.execId);
    });
    it('should succeed to send crashed status to algorithm', async function () {
        const jobData = {
            jobId: `job-${uuid()}`,
            nodeName: 'white',
            pipelineName: 'pipeline-exec',
            priority: 3,
            algorithmName: 'white-alg',
            info: {
                extraData: null,
                lastRunResult: null
            }
        };
        jobConsumer._job = { data: jobData };

        const data = {
            execId: `execId-${uuid()}`,
            algorithmName: 'black-alg',
            input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
        };
        spy = sinon.spy(execAlgorithm, '_sendCompleteToAlgorithm');
        await execAlgorithm._startAlgorithmExecution({ data });
        const execution = execAlgorithm._findTaskByExecId(data.execId);
        const task = {
            jobId: jobData.jobId,
            taskId: execution.taskId,
            status: 'crashed',
            execId: data.execId
        }
        await stateAdapter.updateTask(task);
        await delay(500);
        await delay(500);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('command');
        expect(args).to.have.property('execId');
        expect(args).to.have.property('error');
        expect(args.execId).equals(task.execId);
    });
    it('should handle stop all executions', async function () {
        const size = 5;
        const jobData = {
            jobId: `job-${uuid()}`,
            nodeName: 'white',
            pipelineName: 'pipeline-exec',
            priority: 3,
            algorithmName: 'white-alg',
            info: {
                extraData: null,
                lastRunResult: null
            }
        };
        jobConsumer._job = { data: jobData };
        for (let i = 0; i < size; i++) {
            const data = {
                execId: `execId-${uuid()}`,
                algorithmName: 'black-alg',
                input: [1, 2, false, [1, 2, 3], { data: 'bla' }]
            };
            await execAlgorithm._startAlgorithmExecution({ data });
        }
        const response = await execAlgorithm.stopAllExecutions({ jobId: jobData.jobId });
        expect(response).to.have.lengthOf(size);
        expect(execAlgorithm._executions.size).to.equal(0);
    });
});
