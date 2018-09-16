const uuidv4 = require('uuid/v4');
const configIt = require('@hkube/config');
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
const stateFactory = require('../lib/state/state-factory');
const producer = require('../lib/producer/jobs-producer');
const StateManager = require('../lib/state/state-manager');
const Progress = require('../lib/progress/nodes-progress');
const NodesMap = require('../lib/nodes/nodes-map');
const datastoreFactory = require('../lib/datastore/storage-factory');

let progress, storageAdapter, taskRunner, TaskRunner, stateManager, consumer;
const config = configIt.load().main;
const delay = d => new Promise(r => setTimeout(r, d));

describe('Test', function () {
    before(async () => {
        await datastoreFactory.init(config, true);
        storageAdapter = datastoreFactory.getAdapter();
        await bootstrap.init();
        TaskRunner = require('../lib/tasks/task-runner');
        stateManager = new StateManager(config);
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
        });
        describe('State', function () {
            it('getNodeResults: should not able to get node results', function () {
                const nodesMap = new NodesMap(pipelines[0]);
                expect(() => nodesMap.getNodeResults('not_exists')).to.throw(`unable to find node not_exists`);
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
                const results = nodesMap.getNodeResults(node.nodeName);
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
                const results = nodesMap.getNodeResults(node.nodeName);
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
            xit('should throw validation error job.type should be string', function (done) {
                const options = {
                    taskId: null,
                    type: null
                }
                producer.createJob(options).catch((error) => {
                    expect(error.message).to.equal('data.job.type should be string');
                    done();
                });
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
        });
    });
    describe('TaskRunner', function () {
        beforeEach(function () {
            taskRunner = new TaskRunner(config);
        });
        xit('should throw exception and stop pipeline', function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                data: { jobId },
                done: () => { }
            }
            const error = new Error(`unable to find pipeline ${jobId}`)
            return expect(taskRunner.start(job)).to.eventually.rejectedWith(error.message);
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
            const storageInfo = await storageAdapter.put({ jobId, taskId, data });
            let result = { storageInfo };
            results.data = [{ result }];
            await stateManager.setJobResults(results);
            const etcdResult = await stateManager._etcd.jobResults.get({ jobId: jobId });
            const res = await storageAdapter.get(etcdResult.data.storageInfo);
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
            const storageInfo = await storageAdapter.put({ jobId, taskId, data });
            let result = { storageInfo };
            results.data = [{ result }];
            await stateManager.setJobResults(results);
            const etcdResult = await stateManager._etcd.jobResults.get({ jobId: jobId });
            const res = await storageAdapter.get(etcdResult.data.storageInfo);
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
            const storageInfo = await storageAdapter.put({ jobId, taskId, data });
            let result = { storageInfo };
            results.data = [{ result }];
            await stateManager.setJobResults(results);
            const etcdResult = await stateManager._etcd.jobResults.get({ jobId: jobId });
            const res = await storageAdapter.get(etcdResult.data.storageInfo);
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
        it('unWatchTasks', async function (done) {
            const jobId = `jobid-${uuidv4()}`;
            const taskId = `taskId-${uuidv4()}`;
            const data = { error: 'some different error', status: 'failed' }
            await stateManager.watchTasks({ jobId });
            stateManager.on(Events.TASKS.FAILED, (response) => {
                throw new Error('failed');
            });
            const res = await stateManager.unWatchTasks({ jobId });
            await stateManager._etcd.tasks.setState({ jobId, taskId, error: data.error, status: data.status });
            setTimeout(() => {
                done();
            }, 1000)
        });
        it('watchJobState', async function (done) {
            const jobId = `jobid-${uuidv4()}`;
            await stateManager.watchJobState({ jobId });
            stateManager.on(Events.JOBS.STOP, (response) => {
                if (response.jobId === jobId) {
                    expect(response.jobId).to.equal(jobId);
                    expect(response.state).to.equal('stop');
                    done();
                }
            });
            await stateManager._etcd.jobState.stop({ jobId });
        });
        it('unWatchJobState', async function (done) {
            const jobId = `jobid-${uuidv4()}`;
            await stateManager.watchJobState({ jobId });
            stateManager.on(Events.JOBS.STOP, (response) => {
                throw new Error('failed');
            });
            const response = await stateManager.unWatchJobState({ jobId });
            await stateManager._etcd.jobState.stop({ jobId });
            setTimeout(() => {
                done();
            }, 1000)
        });
    });
    describe('Consumer', function () {
        it('should pause', async function () {
            const spy = sinon.spy(consumer, "_pause");
            await stateFactory._etcd.discovery.set({ serviceName: config.serviceName, instanceId: stateFactory._etcd.discovery._instanceId, data: { status: 'stopProcessing' } });
            await delay(500);
            expect(spy.calledOnce).to.equal(true);
        });
        it('should resume', async function () {
            const spy = sinon.spy(consumer, "_resume");
            await stateFactory._etcd.discovery.set({ serviceName: config.serviceName, instanceId: stateFactory._etcd.discovery._instanceId, data: { status: 'startProcessing' } });
            await delay(500);
            expect(spy.calledOnce).to.equal(true);
        });
    });
    describe('State Factory', function () {
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
            await stateFactory._etcd.discovery.set({ serviceName: config.serviceName, instanceId: stateFactory._etcd.discovery._instanceId, data: { status: 'startProcessing' } });
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
