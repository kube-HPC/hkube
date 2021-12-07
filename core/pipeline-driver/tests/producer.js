const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const pipelines = require('./mocks/pipelines');
let consumer, TaskRunner, stateManager;
const WorkerStub = require('./mocks/worker');
const { delay, createJobId } = require('./utils');

const createJob = (jobId) => {
    const job = {
        data: { jobId },
        done: () => { }
    }
    return job;
}

describe('Producer', function () {
    before(async () => {
        config = testParams.config;
        TaskRunner = require('../lib/tasks/task-runner');
        stateManager = require('../lib/state/state-manager');
        consumer = require('../lib/consumer/jobs-consumer');
    });
    describe('CreateJob', function () {
        it('should create job and handle active status', async function () {
            const jobId = createJobId();
            const job = createJob(jobId);
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const status = 'active';
            const workerStub = new WorkerStub(options);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'dequeued' } });
            await consumer._handleJob(job);
            await delay(500);
            const driver = consumer._drivers.get(jobId);
            const node = driver._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status });
            await delay(500);
            expect(node.status).to.eql(status);
        });
        it('should create job and handle success status', async function () {
            const jobId = createJobId();
            const job = createJob(jobId);
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const status = 'succeed';
            const result = 'test-result';
            const workerStub = new WorkerStub(options);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'dequeued' } });
            await consumer._handleJob(job);
            await delay(500);
            const driver = consumer._drivers.get(jobId);
            const node = driver._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status, result });
            await delay(500);
            expect(node.status).to.eql(status);
            expect(node.result).to.eql(result);
        });
        it('should create job and handle failed status', async function () {
            const jobId = createJobId();
            const job = createJob(jobId);
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const status = 'failed';
            const error = 'test-error';
            const workerStub = new WorkerStub(options);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'dequeued' } });
            await consumer._handleJob(job);
            await delay(500);
            const driver = consumer._drivers.get(jobId);
            const node = driver._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status, error });
            await delay(500);
            expect(node.status).to.eql(status);
            expect(node.error).to.eql(error);
        });
        it('should create job and handle stalled status', async function () {
            const jobId = createJobId();
            const job = createJob(jobId);
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const status = 'stalled';
            const error = 'test-stalled';
            const workerStub = new WorkerStub(options);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'dequeued' } });
            await consumer._handleJob(job);
            await delay(500);
            const driver = consumer._drivers.get(jobId);
            const node = driver._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status, error });
            await delay(500);
            expect(node.status).to.eql(status);
            expect(node.warnings).to.include(error);
        });
        it('should create job and handle crashed status', async function () {
            const jobId = createJobId();
            const job = createJob(jobId);
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const options = {
                type: 'test-job'
            }
            const failed = 'failed';
            const status = 'crashed';
            const error = 'test-crashed';
            const workerStub = new WorkerStub(options);
            await stateManager.createJob({ jobId, pipeline, status: { status: 'dequeued' } });
            await consumer._handleJob(job);
            await delay(500);
            const driver = consumer._drivers.get(jobId);
            const node = driver._nodes.getNode('green');
            await workerStub.done({ jobId, taskId: node.taskId, status, error });
            await delay(500);
            expect(node.status).to.eql(failed);
            expect(node.error).to.eql(error);
        });
        it('should create job and handle invalid status', async function () {
            const jobId = createJobId();
            const job = createJob(jobId);
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const status = 'invalid';
            await stateManager.createJob({ jobId, pipeline, status: { status: 'dequeued' } });
            await consumer._handleJob(job);
            const driver = consumer._drivers.get(jobId);
            const node = driver._nodes.getNode('green');
            await delay(200);
            driver.handleTaskEvent({ jobId, taskId: node.taskId, status });
        });
    });
    describe('CreateJobErrors', function () {
        it('should create job and handle stalled error', async function () {
            const jobId = createJobId();
            const job = createJob(jobId);
            const status = 'completed';
            const error = `pipeline already in ${status} status`;
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            await stateManager.createJob({ jobId, pipeline, status: { status } });
            const promise = consumer._handleJob(job);
            const driver = consumer._drivers.get(jobId);
            const spy = sinon.spy(driver, "_cleanJob");
            await promise;
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0].message).to.equal(error);
        });
    });
});