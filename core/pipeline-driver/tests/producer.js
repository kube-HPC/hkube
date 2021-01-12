const { uid: uuidv4 } = require('@hkube/uid');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const pipelines = require('./mocks/pipelines');
const producer = require('../lib/producer/jobs-producer');
const StateManager = require('../lib/state/state-manager');
let config, TaskRunner, stateManager;
const WorkerStub = require('./mocks/worker');
const { delay } = require('./utils');

describe('Producer', function () {
    before(async () => {
        config = testParams.config;
        TaskRunner = require('../lib/tasks/task-runner');
        stateManager = new StateManager(config);
    });
    describe('CreateJob', function () {
        it('should create job and handle active status', async function () {
            const jobId = `jobid-active-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const status = 'active';
            const workerStub = new WorkerStub(options);
            const taskRunner = new TaskRunner(config);
            await stateManager.createJob({ jobId, pipeline, status: { status } });
            await taskRunner.start(job)
            await delay(500);
            const node = taskRunner._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status });
            await delay(500);
            expect(node.status).to.eql(status);
        });
        it('should create job and handle success status', async function () {
            const jobId = `jobid-success-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const status = 'succeed';
            const result = 'test-result';
            const workerStub = new WorkerStub(options);
            const taskRunner = new TaskRunner(config);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'pending' } });
            await taskRunner.start(job)
            await delay(500);
            const node = taskRunner._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status, result });
            await delay(500);
            expect(node.status).to.eql(status);
            expect(node.result).to.eql(result);
        });
        it('should create job and handle failed status', async function () {
            const jobId = `jobid-failed-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const status = 'failed';
            const error = 'test-error';
            const workerStub = new WorkerStub(options);
            const taskRunner = new TaskRunner(config);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'pending' } });
            await taskRunner.start(job)
            await delay(500);
            const node = taskRunner._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status, error });
            await delay(500);
            expect(node.status).to.eql(status);
            expect(node.error).to.eql(error);
        });
        it('should create job and handle stalled status', async function () {
            const jobId = `jobid-stalled-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const status = 'stalled';
            const error = 'test-stalled';
            const workerStub = new WorkerStub(options);
            const taskRunner = new TaskRunner(config);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'pending' } });
            await taskRunner.start(job)
            await delay(500);
            const node = taskRunner._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status, error });
            await delay(500);
            expect(node.status).to.eql(status);
            expect(node.warnings).to.include(error);
        });
        it('should create job and handle crashed status', async function () {
            const jobId = `jobid-crashed-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const failed = 'failed';
            const status = 'crashed';
            const error = 'test-crashed';
            const workerStub = new WorkerStub(options);
            const taskRunner = new TaskRunner(config);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'pending' } });
            await taskRunner.start(job)
            await delay(500);
            const node = taskRunner._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status, error });
            await delay(500);
            expect(node.status).to.eql(failed);
            expect(node.error).to.eql(error);
        });
        it('should create job and handle invalid status', async function () {
            const jobId = `jobid-invalid-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const status = 'invalid';
            const taskRunner = new TaskRunner(config);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'pending' } });
            await taskRunner.start(job)
            await delay(200);
            const node = taskRunner._nodes.getNode('green');
            taskRunner._handleTaskEvent({ jobId, taskId: node.taskId, status });
        });
    });
    describe('CreateJobErrors', function () {
        it('should create job and handle stalled error', async function () {
            const jobId = `jobid-stalled-error-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const status = 'completed';
            const error = `pipeline already in ${status} status`;
            const taskRunner = new TaskRunner(config);
            const spy = sinon.spy(taskRunner, "_cleanJob");
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            await stateManager.createJob({ jobId, pipeline, status: { status } });
            await taskRunner.start(job);
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0].message).to.equal(error);
        });
    });
});