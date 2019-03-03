const uuidv4 = require('uuid/v4');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const clone = require('clone');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const { Producer } = require('@hkube/producer-consumer');
const Events = require('../lib/consts/Events');
const Batch = require('../lib/nodes/node-batch');
const Node = require('../lib/nodes/node');
const bootstrap = require('../bootstrap');
const pipelines = require('./mocks/pipelines');
const producer = require('../lib/producer/jobs-producer');
const StateManager = require('../lib/state/state-manager');
const Progress = require('../lib/progress/nodes-progress');
const NodesMap = require('../lib/nodes/nodes-map');
const graphStore = require('../lib/datastore/graph-store');
let progress, taskRunner, TaskRunner, stateManager, consumer;
const { main, logger } = configIt.load();
let log = new Logger(main.serviceName, logger);
const storageManager = require('@hkube/storage-manager');
const WorkerStub = require('./mocks/worker')
const config = main;
const delay = d => new Promise(r => setTimeout(r, d));

describe('Test', function () {
    before(async () => {
        await storageManager.init(main, true);
        await bootstrap.init();
        TaskRunner = require('../lib/tasks/task-runner');
        stateManager = new StateManager(main);
        consumer = require('../lib/consumer/jobs-consumer');
    })
    describe('NodesMap', function () {
        describe('Graph', function () {
            it('findEntryNodes: should find entry nodes', function () {
                const pipeline = pipelines.find(p => p.name === 'simple-wait-batch');
                const firstNode = pipeline.nodes[0];
                const nodesMap = new NodesMap(pipeline);
                const entryNodes = nodesMap.findEntryNodes();
                expect(entryNodes[0]).to.equal(firstNode.nodeName);
            });
            it('getNode: should get node by name', function () {
                const pipeline = pipelines.find(p => p.name === 'simple-wait-batch');
                const firstNode = pipeline.nodes[0];
                const nodesMap = new NodesMap(pipeline);
                const node = nodesMap.getNode(firstNode.nodeName);
                expect(node.nodeName).to.equal(firstNode.nodeName);
            });
            it('getNode: should not get node by name', function () {
                const pipeline = pipelines.find(p => p.name === 'simple-wait-batch');
                const nodesMap = new NodesMap(pipeline);
                const node = nodesMap.getNode('not_exists');
                expect(node).to.be.undefined;
            });
            it('should run simple-flow', function () {
                const pipeline = pipelines.find(p => p.name === 'simple-flow');
                const green = pipeline.nodes[0];
                const yellow = pipeline.nodes[1];
                const status = 'succeed';
                const result = 123;
                const nodesMap = new NodesMap(pipeline);
                const node = new Node({
                    nodeName: green.nodeName,
                    algorithmName: green.algorithmName,
                    extraData: green.extraData,
                    input: green.input
                });
                nodesMap.setNode(node);
                nodesMap.on('node-ready', (node) => {
                    expect(node.nodeName).to.equal(yellow.nodeName);
                    expect(node.nodeName).to.equal(pipeline.nodes[1].nodeName);
                    expect(node.parentOutput).to.have.lengthOf(1);
                    expect(node.parentOutput[0].node).to.equal(green.nodeName);
                    expect(node.parentOutput[0].result).to.equal(result);
                    expect(node.parentOutput[0].type).to.equal('waitNode');
                });
                const task = nodesMap.updateTaskState(node.taskId, { status, result });
                nodesMap.updateCompletedTask(task);
            });
            it('should run simple-wait-batch', function () {
                const pipeline = pipelines.find(p => p.name === 'simple-wait-batch');
                const green = pipeline.nodes[0];
                const yellow = pipeline.nodes[1];
                const black = pipeline.nodes[2];
                const nodesMap = new NodesMap(pipeline);
                const node0 = nodesMap.getNode(green.nodeName);
                const node1 = nodesMap.getNode(yellow.nodeName);
                const index = 1;
                const batch0 = new Batch({
                    nodeName: node0.nodeName,
                    batchIndex: index,
                    algorithmName: node0.algorithmName,
                    input: node0.input
                });
                const batch1 = new Batch({
                    nodeName: node1.nodeName,
                    batchIndex: index,
                    algorithmName: node1.algorithmName,
                    input: node1.input
                });
                nodesMap.addBatch(batch0);
                nodesMap.addBatch(batch1);
                nodesMap.updateTaskState(batch0.taskId, { status: 'succeed', result: 123 });
                nodesMap.updateTaskState(batch1.taskId, { status: 'succeed', result: 456 });
                nodesMap.updateCompletedTask(batch0);
                const nodeResults = nodesMap.updateCompletedTask(batch1);
                const node = nodeResults[0][0];
                expect(nodeResults).to.have.lengthOf(1);
                expect(node.nodeName).to.equal(black.nodeName);
                expect(node.index).to.equal(index);
                expect(node.parentOutput).to.have.lengthOf(4);
                expect(node.parentOutput[0].node).to.equal('green');
                expect(node.parentOutput[1].node).to.equal('yellow');
                expect(node.parentOutput[2].node).to.equal('green');
                expect(node.parentOutput[3].node).to.equal('yellow');

                expect(node.parentOutput[0].type).to.equal('waitNode');
                expect(node.parentOutput[1].type).to.equal('waitNode');
                expect(node.parentOutput[2].type).to.equal('waitAny');
                expect(node.parentOutput[3].type).to.equal('waitAny');
            });
            it('should run double-wait-any', function () {
                const pipeline = pipelines.find(p => p.name === 'double-wait-any');
                const black = pipeline.nodes[2];
                const result = 123;
                const nodesMap = new NodesMap(pipeline);
                let nodeResults = null;
                for (let i = 0; i < 2; i++) {
                    const node = pipeline.nodes[i];
                    for (let j = 0; j < 3; j++) {
                        const batch = new Batch({
                            nodeName: node.nodeName,
                            batchIndex: (j + 1),
                            algorithmName: node.algorithmName,
                            input: node.input
                        });
                        nodesMap.addBatch(batch);
                    }
                }
                for (let i = 0; i < 2; i++) {
                    const pnode = pipeline.nodes[i];
                    const node = nodesMap.getNode(pnode.nodeName);
                    node.batch.forEach(b => {
                        nodesMap.updateTaskState(b.taskId, { status: 'succeed', result });
                        nodeResults = nodesMap.updateCompletedTask(b);
                        if (nodeResults.length > 0 && nodeResults[0].length > 0) {
                            const node = nodeResults[0][0];
                            expect(node.index).to.equal(b.batchIndex);
                            expect(node.nodeName).to.equal(black.nodeName);

                            expect(node.parentOutput[0].index).to.equal(b.batchIndex);
                            expect(node.parentOutput[0].node).to.equal('green');
                            expect(node.parentOutput[0].result).to.equal(result);
                            expect(node.parentOutput[0].type).to.equal('waitAny');

                            expect(node.parentOutput[1].index).to.equal(b.batchIndex);
                            expect(node.parentOutput[1].node).to.equal('yellow');
                            expect(node.parentOutput[1].result).to.equal(result);
                            expect(node.parentOutput[1].type).to.equal('waitAny');
                        }
                    })
                }
            });
            it('should run complex-wait-any', function () {
                const pipeline = pipelines.find(p => p.name === 'complex-wait-any');
                const nodesMap = new NodesMap(pipeline);
                const black = pipeline.nodes[2];
                let nodeResults = null;
                for (let i = 0; i < 2; i++) {
                    const node = pipeline.nodes[i];
                    for (let j = 0; j < 3; j++) {
                        const batch = new Batch({
                            nodeName: node.nodeName,
                            batchIndex: (j + 1),
                            algorithmName: node.algorithmName,
                            input: node.input
                        });
                        nodesMap.addBatch(batch);
                    }
                }
                for (let i = 0; i < 2; i++) {
                    const pnode = pipeline.nodes[i];
                    const node = nodesMap.getNode(pnode.nodeName);
                    node.batch.forEach(b => {
                        nodesMap.updateTaskState(b.taskId, { status: 'succeed', result: 123 });
                        nodesMap.updateCompletedTask(b);
                        nodeResults = nodesMap.updateCompletedTask(b);
                        if (nodeResults.length > 0 && nodeResults[0].length > 0) {
                            const node = nodeResults[0][0];
                            expect(node.nodeName).to.equal(black.nodeName);

                            expect(node.parentOutput[0].node).to.equal('green');
                            expect(node.parentOutput[1].node).to.equal('yellow');
                            expect(node.parentOutput[2].node).to.equal('green');
                            expect(node.parentOutput[3].node).to.equal('yellow');

                            expect(node.parentOutput[0].type).to.equal('waitNode');
                            expect(node.parentOutput[1].type).to.equal('waitNode');
                            expect(node.parentOutput[2].type).to.equal('waitAny');
                            expect(node.parentOutput[3].type).to.equal('waitAny');
                        }
                    })

                }
            });
            it('should run simple-wait-any', function () {
                const pipeline = pipelines.find(p => p.name === 'simple-wait-any');
                const nodesMap = new NodesMap(pipeline);
                const black = pipeline.nodes[2];
                let nodeResults = null;
                for (let i = 0; i < 2; i++) {
                    const node = pipeline.nodes[i];
                    for (let j = 0; j < 3; j++) {
                        const batch = new Batch({
                            nodeName: node.nodeName,
                            batchIndex: (j + 1),
                            algorithmName: node.algorithmName,
                            input: node.input
                        });
                        nodesMap.addBatch(batch);
                    }
                }
                for (let i = 0; i < 2; i++) {
                    const pnode = pipeline.nodes[i];
                    const node = nodesMap.getNode(pnode.nodeName);
                    node.batch.forEach(b => {
                        nodesMap.updateTaskState(b.taskId, { status: 'succeed', result: 123 });
                        nodeResults = nodesMap.updateCompletedTask(b);
                        if (nodeResults.length > 0 && nodeResults[0].length > 0) {
                            const node = nodeResults[0][0];
                            expect(node.index).to.equal(b.batchIndex);
                            expect(node.nodeName).to.equal(black.nodeName);

                            expect(node.parentOutput[0].node).to.equal('green');
                            expect(node.parentOutput[1].node).to.equal('green');
                            expect(node.parentOutput[2].node).to.equal('yellow');

                            expect(node.parentOutput[0].type).to.equal('waitNode');
                            expect(node.parentOutput[1].type).to.equal('waitAny');
                            expect(node.parentOutput[2].type).to.equal('waitAny');
                        }
                    })
                }
            });
            it('should update algorithm execution', function () {
                const pipeline = pipelines.find(p => p.name === 'one-node');
                const node = pipeline.nodes[0];
                const nodesMap = new NodesMap(pipeline);

                const execution1 = {
                    nodeName: node.nodeName,
                    algorithmName: 'new-algorithm',
                    execId: `execId-${uuidv4()}`
                }
                const exec1 = nodesMap.updateAlgorithmExecution(execution1);
                expect(exec1.status).to.be.undefined;

                const execution2 = {
                    nodeName: node.nodeName,
                    algorithmName: 'new-algorithm',
                    execId: execution1.execId,
                    status: 'succeed'
                }
                const exec2 = nodesMap.updateAlgorithmExecution(execution2);
                expect(exec2.status).to.equal(execution2.status);
            });
            it('should call setTaskState with execId', async function () {
                const jobId = `jobid-${uuidv4()}`;
                const job = {
                    data: { jobId },
                    done: () => { }
                }
                const pipeline = pipelines.find(p => p.name === 'one-node');
                const node = pipeline.nodes[0];
                const execution = {
                    taskId: `taskId-${uuidv4()}`,
                    execId: `execId-${uuidv4()}`,
                    nodeName: node.nodeName,
                    algorithmName: 'new-algorithm',
                    status: 'succeed'
                }
                const taskRunner = new TaskRunner(config);
                await stateManager.setExecution({ jobId, data: pipeline });
                await taskRunner.start(job)
                taskRunner._setTaskState(execution);
                taskRunner._taskComplete(execution.taskId);
            });
        });
        describe('State', function () {
            it('getNodeResults: should not able to get node results', function () {
                const nodesMap = new NodesMap(pipelines[0]);
                expect(() => nodesMap._getNodeResults('not_exists')).to.throw(`unable to find node not_exists`);
            });
            it('getNodeStates: should not able to get node states', function () {
                const nodesMap = new NodesMap(pipelines[0]);
                expect(() => nodesMap.getNodeStates('not_exists')).to.throw(`unable to find node not_exists`);
            });
            it('updateNodeState: should not able to update node status', function () {
                const nodesMap = new NodesMap(pipelines[0]);
                expect(() => nodesMap.updateTaskState('not_exists')).to.throw(`unable to find task not_exists`);
            });
            it('getNodeResults: should get batch results', function () {
                const pipeline = clone(pipelines[0]);
                const nodesMap = new NodesMap(pipeline);
                const node = pipeline.nodes[0];
                const result = { my: 'OK' };
                nodesMap.addBatch(new Batch({
                    nodeName: node.nodeName,
                    batchIndex: 1,
                    algorithmName: node.algorithmName,
                    result: result
                }));
                const results = nodesMap._getNodeResults(node.nodeName);
                expect(results[0]).to.deep.equal(result);
            });
            it('getNodeResults: should get node results', function () {
                const pipeline = clone(pipelines[0]);
                const nodesMap = new NodesMap(pipeline);
                const node = pipeline.nodes[0];
                const result = { my: 'OK' };
                nodesMap.setNode(new Node({
                    nodeName: node.nodeName,
                    algorithmName: node.algorithmName,
                    result: result
                }));
                const results = nodesMap._getNodeResults(node.nodeName);
                expect(results).to.deep.equal(result);
            });
            it('updateNodeState: should update node status', function () {
                const pipeline = clone(pipelines[0]);
                const nodeName = pipeline.nodes[0].nodeName;
                const nodesMap = new NodesMap(pipeline);
                const node = nodesMap.getNode(nodeName);
                node.taskId = 'should update node status';
                const options = {
                    status: 'complete',
                    result: { my: 'OK' }
                }
                nodesMap.updateTaskState(node.taskId, options);
                const states = nodesMap.getNodeStates(node.nodeName);
                expect(states[0]).to.equal(options.status);
            });
            it('updateNodeState: should update batch status', function () {
                const pipeline = clone(pipelines[0]);
                const node = pipeline.nodes[0];
                const nodesMap = new NodesMap(pipeline);
                const options = {
                    status: 'complete',
                    result: { my: 'OK' }
                }
                const batch = new Batch({
                    taskId: 'should update batch status',
                    nodeName: node.nodeName,
                    batchIndex: 1
                })
                nodesMap.addBatch(batch);
                nodesMap.updateTaskState(batch.taskId, options);
                const states = nodesMap.getNodeStates(node.nodeName);
                expect(states[0]).to.equal(options.status);
            });
            it('isAllNodesCompleted: should return false', function () {
                const pipeline = clone(pipelines[0]);
                const node = pipeline.nodes[0];
                const nodesMap = new NodesMap(pipeline);
                nodesMap.addBatch(new Batch({
                    nodeName: node.nodeName,
                    batchIndex: 1,
                    status: 'complete',
                }));
                const result = nodesMap.isAllNodesCompleted();
                expect(result).to.equal(false);
            });
            it('getAllNodes: should return all nodes', function () {
                const pipeline = clone(pipelines[0]);
                const node = pipeline.nodes[0];
                const nodesMap = new NodesMap(pipeline);
                nodesMap.addBatch(new Batch({
                    nodeName: node.nodeName,
                    batchIndex: 1,
                    status: 'complete',
                }));
                const result = nodesMap.getAllNodes();
                const resultNodes = result.map(r => r.nodeName);
                const pipelineNodes = pipeline.nodes.map(r => r.nodeName);
                expect(resultNodes).to.have.lengthOf(4);
                expect(resultNodes).to.deep.equal(pipelineNodes);
            });
            it('isAllParentsFinished: should return false', function () {
                const pipeline = clone(pipelines[0]);
                const yellow = pipeline.nodes[1];
                const nodesMap = new NodesMap(pipeline);
                const result = nodesMap.isAllParentsFinished(yellow.nodeName);
                expect(result).to.equal(false);
            });
            it('pipelineResults: should return array', function () {
                const pipeline = clone(pipelines[0]);
                const nodesMap = new NodesMap(pipeline);
                const result = nodesMap.pipelineResults();
                expect(result).to.have.lengthOf(2);
            });
            it('should calc progress', function () {
                const pipeline = clone(pipelines[0]);
                const nodesMap = new NodesMap(pipeline);
                const result = nodesMap.calcProgress();
                expect(result).to.have.property('progress');
                expect(result).to.have.property('details');
                expect(result.progress).to.equal(0);
                expect(result.details).to.equal('0% completed, 4 creating');
            });
        });
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
                await stateManager.setExecution({ jobId, data: pipeline });
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
                await stateManager.setExecution({ jobId, data: pipeline });
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
                await stateManager.setExecution({ jobId, data: pipeline });
                await taskRunner.start(job)
                await delay(500);
                const node = taskRunner._nodes.getNode('green');
                await workerStub.done({ jobId, taskId: jobId, taskId: node.taskId, status, error });
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
                await stateManager.setExecution({ jobId, data: pipeline });
                await taskRunner.start(job)
                await delay(500);
                const node = taskRunner._nodes.getNode('green');
                await workerStub.done({ jobId, taskId: jobId, taskId: node.taskId, status, error });
                await delay(500);
                expect(node.status).to.eql(status);
                expect(node.error).to.eql(error);
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
                await stateManager.setExecution({ jobId, data: pipeline });
                await taskRunner.start(job)
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
                await stateManager.setExecution({ jobId, data: pipeline });
                await taskRunner.start(job)
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
                await taskRunner.start(job);

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
        it('should throw exception and stop pipeline', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const error = `unable to find pipeline for job ${jobId}`;
            const spy = sinon.spy(taskRunner, "stop");
            await taskRunner.start(job)
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0].message).to.equal(error);
        });
        it('should start only one pipeline', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            await stateManager.setExecution({ jobId, data: pipeline });
            const res1 = await taskRunner.start(job);
            const res2 = await taskRunner.start(job);

            expect(res1.name).to.equal('two-nodes');
            expect(res2).to.be.null;
        });
        it('should start pipeline successfully', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines[1];
            await stateManager.setExecution({ jobId, data: pipeline });
            await taskRunner.start(job)
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
            await stateManager.setExecution({ jobId, data: pipeline });
            await taskRunner.start(job);

            const tasks = taskRunner._nodes._getNodesAsFlat();

            for (let i = 0; i < 4; i++) {
                taskRunner._nodes.updateTaskState(tasks[i].taskId, { status: 'failed', error: 'oooohh noooo' });
            }
            const result = taskRunner._checkBatchTolerance(tasks[0]);
            expect(result.message).to.equal("4/5 (80%) failed tasks, batch tolerance is 60%, error: oooohh noooo");
        });
        it('should recover existing pipeline', async function () {
            const jobId = `jobid-active-event-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'two-nodes');
            const node1 = new Node({ nodeName: 'green', status: 'creating' });
            const node2 = new Node({ nodeName: 'yellow', status: 'creating' });
            const taskRunner = new TaskRunner(config);
            const nodesMap = new NodesMap(pipeline);
            nodesMap.setNode(node1);
            nodesMap.setNode(node2);
            await stateManager.setExecution({ jobId, data: pipeline });
            await stateManager._etcd.tasks.setState({ jobId, taskId: node1.taskId, status: 'succeed' });
            await stateManager._etcd.tasks.setState({ jobId, taskId: node2.taskId, status: 'succeed' });

            const spy = sinon.spy(taskRunner, "_recoverPipeline");

            await graphStore.start(job.data.jobId, nodesMap);
            await taskRunner.start(job)

            expect(spy.calledOnce).to.equal(true);
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
            const etcdResult = await stateManager._etcd.jobResults.get({ jobId: jobId });
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
            const etcdResult = await stateManager._etcd.jobResults.get({ jobId: jobId });
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
            const etcdResult = await stateManager._etcd.jobResults.get({ jobId: jobId });
            const res = await storageManager.get(etcdResult.data.storageInfo);
            expect(data).to.deep.equal(res[0].result);
        });
        it('setJobStatus', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'completed' };
            await stateManager.setJobStatus({ jobId, data });
            const response = await stateManager._etcd.jobStatus.get({ jobId });
            expect(response.data).to.deep.equal(data);
        });
        it('getExecution', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'completed' };
            await stateManager.setExecution({ jobId, data });
            const response = await stateManager.getExecution({ jobId });
            expect(response).to.deep.equal(data);
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
                await stateManager._etcd.tasks.setState({ jobId, taskId, error: data.error, status: data.status });
                setTimeout(() => {
                    resolve();
                }, 1000)
            });
        });
        it('watchJobState', function () {
            return new Promise(async (resolve, reject) => {
                const jobId = `jobid-${uuidv4()}`;
                await stateManager.watchJobState({ jobId });
                stateManager.on(Events.JOBS.STOP, (response) => {
                    if (response.jobId === jobId) {
                        expect(response.jobId).to.equal(jobId);
                        expect(response.state).to.equal('stop');
                        resolve();
                    }
                });
                await stateManager._etcd.jobState.stop({ jobId });
            });
        });
        it('unWatchJobState', function () {
            return new Promise(async (resolve, reject) => {
                const jobId = `jobid-${uuidv4()}`;
                await stateManager.watchJobState({ jobId });
                stateManager.on(Events.JOBS.STOP, (response) => {
                    throw new Error('failed');
                });
                await stateManager.unWatchJobState({ jobId });
                await stateManager._etcd.jobState.stop({ jobId });
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
            const pipeline = pipelines[0];
            await stateManager.setExecution({ jobId, data: pipeline });
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
