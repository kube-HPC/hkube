const { expect } = require('chai');
const sinon = require('sinon');
const delay = require('delay');
const uuid = require('uuid/v4');
const execAlgorithm = require('../lib/code-api/algorithm-execution/algorithm-execution');
const jobConsumer = require('../lib/consumer/JobConsumer');
const etcd = require('../lib/states/discovery');

describe('AlgorithmExecutions', () => {
    let spy;
    before(function () {
        let options = { name: 'black-alg', data: 'bla' };
        etcd.createAlgorithmType(options);
    });
    after(function () {
        let options = { name: 'black-alg', data: 'bla' };
        etcd.deleteAlgorithmType(options);
    });
    afterEach(function () {
        spy && spy.restore();
        execAlgorithm._watching = false;
        execAlgorithm._executions.clear();
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
        expect(args.error).equals(`execution already running`);
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
        expect(args).to.have.property('data');
        expect(args).to.have.property('type');
        expect(args.type).equals(data.algorithmName);
        expect(args.data.tasks[0]).to.have.property('execId');
        expect(args.data.tasks[0]).to.have.property('input');
        expect(args.data.tasks[0]).to.have.property('storage');
        expect(args.data.tasks[0]).to.have.property('taskId');
        expect(args.data.tasks[0].execId).equals(data.execId);
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
        const execution = execAlgorithm._executions.get(data.execId);
        const task = {
            jobId: jobData.jobId,
            taskId: execution.taskId,
            status: 'succeed',
            execId: data.execId
        }
        await etcd.update(task);
        await delay(500);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('command');
        expect(args).to.have.property('execId');
        expect(args).to.have.property('jobId');
        expect(args).to.have.property('status');
        expect(args).to.have.property('taskId');
        expect(args.execId).equals(task.execId);
        expect(args.jobId).equals(task.jobId);
        expect(args.status).equals(task.status);
        expect(args.taskId).equals(task.taskId);
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
        const execution = execAlgorithm._executions.get(data.execId);
        const task = {
            jobId: jobData.jobId,
            taskId: execution.taskId,
            status: 'failed',
            execId: data.execId
        }
        await etcd.update(task);
        await delay(500);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('command');
        expect(args).to.have.property('execId');
        expect(args).to.have.property('jobId');
        expect(args).to.have.property('status');
        expect(args).to.have.property('taskId');
        expect(args.execId).equals(task.execId);
        expect(args.jobId).equals(task.jobId);
        expect(args.status).equals(task.status);
        expect(args.taskId).equals(task.taskId);
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
        const execution = execAlgorithm._executions.get(data.execId);
        const task = {
            jobId: jobData.jobId,
            taskId: execution.taskId,
            status: 'stalled',
            execId: data.execId
        }
        await etcd.update(task);
        await delay(500);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('command');
        expect(args).to.have.property('execId');
        expect(args).to.have.property('jobId');
        expect(args).to.have.property('status');
        expect(args).to.have.property('taskId');
        expect(args.execId).equals(task.execId);
        expect(args.jobId).equals(task.jobId);
        expect(args.status).equals(task.status);
        expect(args.taskId).equals(task.taskId);
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
        const execution = execAlgorithm._executions.get(data.execId);
        const task = {
            jobId: jobData.jobId,
            taskId: execution.taskId,
            status: 'crashed',
            execId: data.execId
        }
        await etcd.update(task);
        await delay(500);
        await delay(500);
        const args = spy.getCalls()[0].args[0];
        expect(args).to.have.property('command');
        expect(args).to.have.property('execId');
        expect(args).to.have.property('jobId');
        expect(args).to.have.property('status');
        expect(args).to.have.property('taskId');
        expect(args.execId).equals(task.execId);
        expect(args.jobId).equals(task.jobId);
        expect(args.status).equals(task.status);
        expect(args.taskId).equals(task.taskId);
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
