const uuidv4 = require('uuid/v4');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const { Producer } = require('@hkube/producer-consumer');
const Events = require('../lib/consts/Events');
const DriverStates = require('../lib/state/DriverStates.js');
const bootstrap = require('../bootstrap');
const pipelines = require('./mocks/pipelines');
const producer = require('../lib/producer/jobs-producer');
const StateManager = require('../lib/state/state-manager');
const Progress = require('../lib/progress/nodes-progress');
let progress, taskRunner, TaskRunner, stateManager, consumer;
const { main, logger } = configIt.load();
let log = new Logger(main.serviceName, logger);
const storageManager = require('@hkube/storage-manager');
const WorkerStub = require('./mocks/worker')
const config = main;
const delay = d => new Promise(r => setTimeout(r, d));

describe('Test', function () {
    before(async () => {
        await storageManager.init(main, log, true);
        await bootstrap.init();
        TaskRunner = require('../lib/tasks/task-runner');
        stateManager = new StateManager(main);
        consumer = require('../lib/consumer/jobs-consumer');
    });
    describe('Producer', function () {
        describe('Validation', function () {
            it('should not throw validation error', function () {
                producer.init(null);
            });
        });
        describe('CreateJob', function () {
            it('should create job and return job id', function (done) {
                const options = {
                    type: 'test-job'
                }
                producer.createJob(options).then((jobId) => {
                    expect(jobId).to.be.a('string');
                    done();
                });
            });
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
                await stateManager.setExecution({ jobId, ...pipeline });
                await taskRunner.pipelineStarted(job)
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
                await stateManager.setExecution({ jobId, ...pipeline });
                await taskRunner.pipelineStarted(job)
                await delay(500);
                const node = taskRunner._nodes.getNode('green');
                await workerStub.done({ jobId, taskId: node.taskId, status, result });
                await delay(500);
                expect(node.status).to.eql(status);
                expect(node.result).to.eql(result);
            });
            it('should create job and handle failed status', async function () {
                this.timeout(3000);
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
                await stateManager.setExecution({ jobId, ...pipeline });
                await taskRunner.pipelineStarted(job)
                await delay(500);
                const node = taskRunner._nodes.getNode('green');
                await workerStub.done({ jobId, taskId: jobId, taskId: node.taskId, status, error });
                await delay(500);
                expect(node.status).to.eql(status);
                expect(node.error).to.eql(error);
            });
            it('should create job and handle stalled status', async function () {
                this.timeout(3000);
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
                await stateManager.setExecution({ jobId, ...pipeline });
                await taskRunner.pipelineStarted(job)
                await delay(500);
                const node = taskRunner._nodes.getNode('green');
                await workerStub.done({ jobId, taskId: jobId, taskId: node.taskId, status, error });
                await delay(500);
                expect(node.status).to.eql(status);
                expect(node.prevErrors).to.include(error);
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
                await stateManager.setExecution({ jobId, ...pipeline });
                await taskRunner.pipelineStarted(job)
                await delay(500);
                const node = taskRunner._nodes.getNode('green');
                await workerStub.done({ jobId, taskId: jobId, taskId: node.taskId, status, error });
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
                const options = {
                    type: 'test-job'
                }
                const status = 'invalid';
                const taskRunner = new TaskRunner(config);
                await stateManager.setExecution({ jobId, ...pipeline });
                await taskRunner.pipelineStarted(job)
                await delay(200);
                const node = taskRunner._nodes.getNode('green');
                taskRunner._handleTaskEvent({ jobId, taskId: jobId, taskId: node.taskId, status });
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

                await stateManager.setJobStatus({ jobId, status });
                await taskRunner.pipelineStarted(job);

                const call = spy.getCalls()[0];
                expect(spy.calledOnce).to.equal(true);
                expect(call.args[0].message).to.equal(error);
            });
        });
    });
    describe('TaskRunner', function () {
        beforeEach(function () {
            taskRunner = new TaskRunner(main);
        });
        it('should throw exception and fail pipeline', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const error = `unable to find pipeline for job ${jobId}`;
            const spy = sinon.spy(taskRunner, 'pipelineFailed');
            await taskRunner.pipelineStarted(job)
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0].error.message).to.equal(error);
        });
        it('should start only one pipeline', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            await stateManager.setExecution({ jobId, ...pipeline });
            const res1 = await taskRunner.pipelineStarted(job);
            const res2 = await taskRunner.pipelineStarted(job);

            expect(res1.name).to.equal('two-nodes');
            expect(res2).to.be.null;
        });
        it('should start pipeline successfully', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'flow2');
            await stateManager.setExecution({ jobId, ...pipeline });
            await taskRunner.pipelineStarted(job)
            expect(taskRunner._jobId).to.equal(jobId);
            expect(taskRunner._active).to.equal(true);
            expect(taskRunner.pipeline.name).to.equal(pipeline.name);
        });
        it('should recover pipeline successfully', async function () {
        });
        it('should throw when check batch tolerance', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'batch');
            const node = pipeline.nodes[0];
            await stateManager.setExecution({ jobId, ...pipeline });
            await taskRunner.pipelineStarted(job);

            const tasks = taskRunner._nodes._getNodesAsFlat();

            for (let i = 0; i < 4; i++) {
                taskRunner._nodes.updateTaskState(tasks[i].taskId, { status: 'failed', error: 'oooohh noooo' });
            }
            const result = taskRunner._checkTaskErrors(tasks[0]);
            expect(result.message).to.equal("4/5 (80%) failed tasks, batch tolerance is 60%, error: oooohh noooo");
        });
        it('should create job and handle success after stalled status', async function () {
            const jobId = `jobid-stalled-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const spy = sinon.spy(taskRunner, "pipelineCompleted");
            const pipeline = pipelines.find(p => p.name === 'one-node');
            await stateManager.setExecution({ jobId, ...pipeline });
            await taskRunner.pipelineStarted(job);
            const node = taskRunner._nodes.getNode('green');
            const taskId = node.taskId;
            await stateManager._etcd.jobs.tasks.set({ jobId, taskId, error: 'taskStalled', status: 'stalled' });
            await delay(300);
            await stateManager._etcd.jobs.tasks.set({ jobId, taskId, status: 'succeed' });
            await delay(300);
            expect(spy.calledOnce).to.equal(true);
            expect(taskRunner._jobStatus).to.equal('completed');
        });
        it('should create job and handle failed after stalled status', async function () {
            const jobId = `jobid-stalled-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const spy = sinon.spy(taskRunner, "pipelineCompleted");
            const pipeline = pipelines.find(p => p.name === 'one-node');
            await stateManager.setExecution({ jobId, ...pipeline });
            await taskRunner.pipelineStarted(job);
            const node = taskRunner._nodes.getNode('green');
            const taskId = node.taskId;
            await stateManager._etcd.jobs.tasks.set({ jobId, taskId, error: 'taskStalled', status: 'stalled' });
            await delay(300);
            await stateManager._etcd.jobs.tasks.set({ jobId, taskId, status: 'failed' });
            await delay(300);
            expect(spy.calledOnce).to.equal(true);
            expect(taskRunner._jobStatus).to.equal('completed');

        });
    });
    describe('RecoverPipeline', function () {
        it('should recover existing pipeline', function () {
            this.timeout(5000);
            return new Promise(async (resolve, reject) => {
                const jobId = `jobid-recover-${uuidv4()}`;
                const job = {
                    data: { jobId },
                    done: () => { }
                }
                let index = 0;
                const pipeline = pipelines.find(p => p.name === 'simple-flow');
                await stateManager.setExecution({ jobId, ...pipeline });
                const taskRunner = new TaskRunner(config);
                await taskRunner.pipelineStarted(job);

                let spy1, spy2;
                const result = { arr: [1, 2, 3] };

                const runNext = async (nodeName) => {
                    const next = pipeline.nodes[++index];
                    if (!next) {
                        return resolve();
                    }

                    const node = taskRunner._nodes.getNode(nodeName);
                    await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node.taskId, result, status: 'succeed' });

                    taskRunner._active = false;
                    await taskRunner._unWatchJob();

                    spy1 = sinon.spy(taskRunner, "_runNode");
                    spy2 = sinon.spy(taskRunner, "_recoverPipeline");
                    await taskRunner.pipelineStarted(job);

                    await delay(300);

                    const call1 = spy1.getCalls()[0];
                    expect(spy1.calledOnce).to.equal(true);
                    expect(call1.args[0]).to.equal(next.nodeName);
                    expect(call1.args[1][0].result).to.deep.equal(result);
                    expect(spy2.calledOnce).to.equal(true);

                    spy1.restore();
                    spy2.restore();
                    runNext(next.nodeName);

                }
                runNext(pipeline.nodes[index].nodeName);
            });
        });
    });
    describe('Progress', function () {
        beforeEach(() => {
            progress = new Progress();
        })
        it('should call progress with level silly', function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'active' };
            const spy = sinon.spy(progress, "_progress");
            progress.silly({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('silly');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level debug', function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'active' };
            const spy = sinon.spy(progress, "_progress");
            progress.debug({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('debug');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level info', function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'active' };
            const spy = sinon.spy(progress, "_progress");
            progress.info({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('info');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level warning', function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'active' };
            const spy = sinon.spy(progress, "_progress");
            progress.warning({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('warning');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level error', function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'active' };
            const spy = sinon.spy(progress, "_progress");
            progress.error({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('error');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level critical', function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'active' };
            const spy = sinon.spy(progress, "_progress");
            progress.critical({ jobId, status: data.status })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('critical');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
    });
    describe('StateManager', function () {
        it('setJobResults', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const taskId = `taskId-${uuidv4()}`;
            const data = [{ koko: [1, 2, 3] }];
            const results = {
                jobId,
                data
            };
            const storageInfo = await storageManager.hkube.put({ jobId, taskId, data });
            let result = { storageInfo };
            results.data = [{ result }];
            await stateManager.setJobResults(results);
            const etcdResult = await stateManager._etcd.jobs.results.get({ jobId: jobId });
            const res = await storageManager.get(etcdResult.data.storageInfo);
            expect(data).to.deep.equal(res[0].result);
        });
        it('setJobResults with null', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const taskId = `taskId-${uuidv4()}`;
            const data = [{ koko: [null, 2, 3] }];
            const results = {
                jobId,
                data
            };
            const storageInfo = await storageManager.hkube.put({ jobId, taskId, data });
            let result = { storageInfo };
            results.data = [{ result }];
            await stateManager.setJobResults(results);
            const etcdResult = await stateManager._etcd.jobs.results.get({ jobId: jobId });
            const res = await storageManager.get(etcdResult.data.storageInfo);
            expect(data).to.deep.equal(res[0].result);
        });
        it('setJobResults with error', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const taskId = `taskId-${uuidv4()}`;
            const data = [
                {
                    "nodeName": "eval1",
                    "batchIndex": 1,
                    "algorithmName": "eval-alg",
                    "error": "Error: no odd numbers"
                },
                {
                    "nodeName": "eval1",
                    "batchIndex": 2,
                    "algorithmName": "eval-alg",
                    "result": {
                        "xxx": {}
                    }
                }];
            const results = {
                jobId,
                data
            };
            const storageInfo = await storageManager.hkube.put({ jobId, taskId, data });
            let result = { storageInfo };
            results.data = [{ result }];
            await stateManager.setJobResults(results);
            const etcdResult = await stateManager._etcd.jobs.results.get({ jobId: jobId });
            const res = await storageManager.get(etcdResult.data.storageInfo);
            expect(data).to.deep.equal(res[0].result);
        });
        it('setJobStatus', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'completed' };
            await stateManager.setJobStatus({ jobId, data });
            const response = await stateManager._etcd.jobs.status.get({ jobId });
            expect(response.data).to.deep.equal(data);
        });
        it('getExecution', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const options = { jobId, status: 'completed' };
            await stateManager.setExecution(options);
            const response = await stateManager.getExecution(options);
            expect(response).to.deep.equal(options);
        });
        it('unWatchTasks', function () {
            return new Promise(async (resolve, reject) => {
                const jobId = `jobid-${uuidv4()}`;
                const taskId = `taskId-${uuidv4()}`;
                const data = { error: 'some different error', status: 'failed' }
                await stateManager.watchTasks({ jobId });
                stateManager.on(Events.TASKS.FAILED, (response) => {
                    throw new Error('failed');
                });
                await stateManager.unWatchTasks({ jobId });
                await stateManager._etcd.jobs.tasks.set({ jobId, taskId, error: data.error, status: data.status });
                setTimeout(() => {
                    resolve();
                }, 1000)
            });
        });
        it('watchJobStatus', function () {
            return new Promise(async (resolve, reject) => {
                const jobId = `jobid-${uuidv4()}`;
                await stateManager.watchJobStatus({ jobId });
                stateManager.on(Events.JOBS.STOPPED, (response) => {
                    if (response.jobId === jobId) {
                        expect(response.jobId).to.equal(jobId);
                        expect(response.status).to.equal(DriverStates.STOPPED);
                        resolve();
                    }
                });
                await stateManager._etcd.jobs.status.set({ jobId, status: DriverStates.STOPPED });
            });
        });
        it('unWatchJobStatus', function () {
            return new Promise(async (resolve, reject) => {
                const jobId = `jobid-${uuidv4()}`;
                await stateManager.watchJobStatus({ jobId });
                stateManager.on(Events.JOBS.STOPPED, (response) => {
                    throw new Error('failed');
                });
                await stateManager.unWatchJobStatus({ jobId });
                await stateManager._etcd.jobs.status.set({ jobId, status: DriverStates.STOPPED });
                setTimeout(() => {
                    resolve();
                }, 1000)
            });
        });
    });
    xdescribe('Consumer', function () {
        it('should pause', async function () {
            const spy = sinon.spy(consumer, "_pause");
            await stateFactory._etcd.discovery.set({ serviceName: main.serviceName, instanceId: stateFactory._etcd.discovery._instanceId, data: { status: 'stopProcessing' } });
            await delay(500);
            expect(spy.calledOnce).to.equal(true);
        });
        it('should resume', async function () {
            const spy = sinon.spy(consumer, "_resume");
            await stateFactory._etcd.discovery.set({ serviceName: main.serviceName, instanceId: stateFactory._etcd.discovery._instanceId, data: { status: 'startProcessing' } });
            await delay(500);
            expect(spy.calledOnce).to.equal(true);
        });
    });
    xdescribe('State Factory', function () {
        it('should get state', async function () {
            this.timeout(5000);
            const jobId = `jobid-${uuidv4()}`;
            const setting = {
                prefix: 'pipeline-driver'
            };
            const options = {
                job: {
                    type: 'pipeline-job',
                    data: {
                        jobId
                    }
                }
            };
            const pipeline = pipelines.find(p => p.name === 'simple-flow');
            await stateManager.setExecution({ jobId, ...pipeline });
            await stateFactory._etcd.discovery.set({ serviceName: main.serviceName, instanceId: stateFactory._etcd.discovery._instanceId, data: { status: 'startProcessing' } });
            const producer = new Producer({ setting });
            await producer.createJob(options);
            await delay(500);
            const state = stateFactory.getState();
            expect(state.paused).to.equal(false);
            expect(state.driverStatus).to.equal('active');
            expect(state.jobStatus).to.equal('active');
            expect(state.jobId).to.equal(jobId);
            expect(state.pipelineName).to.equal('simple-flow');
        });
    });
});