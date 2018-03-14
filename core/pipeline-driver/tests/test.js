const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
const configIt = require('@hkube/config');
const clone = require('clone');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const Events = require('../lib/consts/Events');
const Batch = require('../lib/nodes/node-batch');
const WaitBatch = require('../lib/nodes/node-wait-batch');
const Node = require('../lib/nodes/node');
const Task = require('../lib/tasks/Task');
const bootstrap = require('../bootstrap');
const pipelines = require('./mocks/pipelines');
const producer = require('../lib/producer/jobs-producer');
const consumer = require('../lib/consumer/jobs-consumer');
const stateManager = require('../lib/state/state-manager');
const progress = require('../lib/progress/nodes-progress');
const NodesMap = require('../lib/nodes/nodes-map');
const WorkerStub = require('./mocks/worker');
let taskRunner = null;

describe('Test', function () {
    before(async () => {
        await bootstrap.init();
        taskRunner = require('../lib/tasks/task-runner');
    })
    describe('Producer', function () {
        describe('Validation', function () {
            it('should not throw validation error', function () {
                producer.init(null);
            });
            it('should throw validation error job.type should be string', function (done) {
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
                producer.createJob(options).then((jobID) => {
                    expect(jobID).to.be.a('string');
                    done();
                });
            });
        });
    });
    describe('Consumer', function () {
        describe('ConsumeJob', function () {
            it('should consume a job with properties', async function (done) {
                const jobId = `jobid-${uuidv4()}`;
                const data = { test: 'OK' };
                consumer.on(Events.JOBS.START, async (job) => {
                    if (job.id === jobId) {
                        expect(job.data).to.deep.equal(data);
                        done();
                    }
                });
                const setting = {
                    prefix: 'jobs-pipeline'
                }
                const options = {
                    job: {
                        id: jobId,
                        type: 'pipeline-driver-job',
                        data: data
                    }
                }
                await stateManager.setExecution({ jobId, data: pipelines[1] });
                const p = new Producer({ setting: setting });
                p.createJob(options);
            });
        });
    });
    describe('TaskRunner', function () {
        beforeEach(function () {
            taskRunner._job = null;
            taskRunner._jobId = null;
            taskRunner._pipeline = null;
            taskRunner._nodes = null;
            taskRunner._active = false;
            taskRunner._pipelineName = null;
        });
        it('should throw exception and stop pipeline', function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                id: jobId
            }
            const error = new Error(`unable to find pipeline ${jobId}`)
            return expect(taskRunner._startPipeline(job)).to.eventually.rejectedWith(error.message);
        });
        it('should start pipeline successfully', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                id: jobId,
                done: () => { }
            }
            const pipeline = pipelines[1];
            await stateManager.setExecution({ jobId, data: pipeline });
            await taskRunner._startPipeline(job)
            expect(taskRunner._jobId).to.equal(jobId);
            expect(taskRunner._active).to.equal(true);
            expect(taskRunner._pipelineName).to.equal(pipeline.name);
        });
        it('should recover pipeline successfully', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const taskIds = [uuidv4(), uuidv4(), uuidv4()];
            const job = {
                id: jobId,
                done: () => { }
            }
            const pipeline = pipelines[0];
            const node = pipeline.nodes[0];
            const task1 = new Node({
                taskId: taskIds[0],
                nodeName: node.nodeName,
                algorithmName: node.algorithmName
            })
            const task2 = new Batch({
                taskId: taskIds[1],
                batchIndex: 1,
                nodeName: node.nodeName,
                algorithmName: node.algorithmName
            })
            const task3 = new WaitBatch({
                taskId: taskIds[2],
                w_runWaitAnyBatchaitBatch: true,
                nodeName: node.nodeName,
                algorithmName: node.algorithmName
            })
            const data = { status: 'completed' };
            await stateManager.setDriverState({ jobId, data });
            await stateManager.setTaskState({ jobId, taskId: task1.taskId, data: task1 });
            await stateManager.setTaskState({ jobId, taskId: task2.taskId, data: task2 });
            await stateManager.setTaskState({ jobId, taskId: task3.taskId, data: task3 });

            await stateManager._etcd.tasks.setState({ jobId: jobId, taskId: task1.taskId, result: 0, status: 'completed' });
            await stateManager._etcd.tasks.setState({ jobId: jobId, taskId: task2.taskId, result: 1, status: 'completed' });
            await stateManager._etcd.tasks.setState({ jobId: jobId, taskId: task3.taskId, error: 'error', status: 'failed' });

            const state = await stateManager.getState({ jobId: jobId });
            taskRunner._nodes = new NodesMap(pipeline);
            const tasks = taskRunner._checkRecovery(state);
            expect(tasks).to.have.lengthOf(3);
        });
        it('should throw when check batch tolerance', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const job = {
                id: jobId,
                done: () => { }
            }
            const pipeline = pipelines.find(p => p.name === 'batch');
            const node = pipeline.nodes[0];
            await stateManager.setExecution({ jobId, data: pipeline });
            await taskRunner._startPipeline(job);

            const tasks = taskRunner._nodes._getNodesAsFlat();

            for (let i = 0; i < 4; i++) {
                taskRunner._nodes.updateTaskState(tasks[i].taskId, { status: 'failed', error: 'oooohh noooo' });
            }
            const result = taskRunner._checkBatchTolerance(tasks[0]);
            expect(result.message).to.equal("4/5 (80%) failed tasks, batch tolerance is 60%, error: oooohh noooo");
        });
    });
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
        });
        describe('ActualGraph', function () {
            it('should find Actual By Target And Index', function () {
                const pipeline = {
                    "nodes": [
                        {
                            "nodeName": "green",
                            "algorithmName": "green-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "yellow",
                            "algorithmName": "yellow-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "black",
                            "algorithmName": "black-alg",
                            "input": [
                                "*@green",
                                "*@yellow",
                                "@green",
                                "@yellow"
                            ]
                        }
                    ]
                }
                const pNode = pipeline.nodes[0];
                const batch = new Batch({
                    taskId: uuidv4(),
                    nodeName: pNode.nodeName,
                    batchIndex: 1,
                    algorithmName: pNode.algorithmName
                });

                const nodesMap = new NodesMap(pipeline);
                nodesMap.updateCompletedTask(batch);

                const node = nodesMap._actualGraph.findByTargetAndIndex('black', 1);
                const link = node.links[0];
                const edge = link.edges.find(e => e.type === 'waitAny');

                expect(edge.completed).to.equal(true);
                expect(edge.index).to.equal(1);
            });
            it('should update Actual By Source', function () {
                const pipeline = {
                    "nodes": [
                        {
                            "nodeName": "green",
                            "algorithmName": "green-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "yellow",
                            "algorithmName": "yellow-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "black",
                            "algorithmName": "black-alg",
                            "input": [
                                "*@green",
                                "*@yellow",
                                "@green",
                                "@yellow"
                            ]
                        }
                    ]
                }
                const batchCount = 3;
                const pNode = pipeline.nodes[0];
                const nodesMap = new NodesMap(pipeline);

                for (var i = 0; i < batchCount; i++) {
                    const batch = new Batch({
                        taskId: uuidv4(),
                        nodeName: pNode.nodeName,
                        batchIndex: (i + 1)
                    });
                    nodesMap.updateCompletedTask(batch);
                }

                const count = nodesMap._actualGraph.updateBySource(pNode.nodeName, { data: 'OK' });
                expect(count).to.equal(batchCount);
            });
            it('should find Actual By edge', function () {
                const pipeline = {
                    "nodes": [
                        {
                            "nodeName": "green",
                            "algorithmName": "green-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "yellow",
                            "algorithmName": "yellow-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "black",
                            "algorithmName": "black-alg",
                            "input": [
                                "*@green",
                                "*@yellow",
                                "@green",
                                "@yellow"
                            ]
                        }
                    ]
                }
                const pNode = pipeline.nodes[0];
                const batch = new Batch({
                    taskId: uuidv4(),
                    nodeName: pNode.nodeName,
                    batchIndex: 1,
                    algorithmName: pNode.algorithmName
                });

                const nodesMap = new NodesMap(pipeline);
                nodesMap.updateCompletedTask(batch);

                const node = nodesMap._actualGraph.findByEdge(pNode.nodeName, 'black');
                const link0 = node.links[0];
                const link1 = node.links[1];
                const edges1 = link0.edges.map(e => e.type);
                const edges2 = link1.edges.map(e => e.type);

                expect(link0.source).to.equal('green');
                expect(link0.target).to.equal('black');
                expect(link1.source).to.equal('yellow');
                expect(link0.target).to.equal('black');

                expect(edges1).to.deep.equal(['waitAny', 'waitNode']);
                expect(edges2).to.deep.equal(['waitAny', 'waitNode']);
            });
        });
        describe('VirtualGraph', function () {
            it('should create virtualGraph', function () {
                const pipeline = pipelines.find(p => p.name === 'simple-wait-batch');
                const nodesMap = new NodesMap(pipeline);
                const vg = nodesMap._virtualGraph.list[0];
                const link = vg.links[0];
                expect(nodesMap).to.have.property('_virtualGraph');
                expect(vg).to.have.property('id');
                expect(vg).to.have.property('links');
                expect(link).to.have.property('edges');
                expect(link).to.have.property('source');
                expect(link).to.have.property('target');
            });
            it('should create virtualGraph with links and edges', function () {
                const pipeline = {
                    "nodes": [
                        {
                            "nodeName": "green",
                            "algorithmName": "green-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "yellow",
                            "algorithmName": "yellow-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "black",
                            "algorithmName": "black-alg",
                            "input": [
                                "*@green",
                                "*@yellow",
                                "@green",
                                "@yellow"
                            ]
                        }
                    ]
                }
                const nodesMap = new NodesMap(pipeline);
                const link0 = nodesMap._virtualGraph.list[0].links[0];
                const link1 = nodesMap._virtualGraph.list[0].links[1];
                const edges1 = link0.edges.map(e => e.type);
                const edges2 = link1.edges.map(e => e.type);

                expect(link0.source).to.equal('green');
                expect(link0.target).to.equal('black');
                expect(link1.source).to.equal('yellow');
                expect(link0.target).to.equal('black');

                expect(edges1).to.deep.equal(['waitAny', 'waitNode']);
                expect(edges2).to.deep.equal(['waitAny', 'waitNode']);
            });
            it('should find Virtual node By Target', function () {
                const pipeline = {
                    "nodes": [
                        {
                            "nodeName": "green",
                            "algorithmName": "green-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "yellow",
                            "algorithmName": "yellow-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "black",
                            "algorithmName": "black-alg",
                            "input": [
                                "*@green",
                                "*@yellow",
                                "@green",
                                "@yellow"
                            ]
                        }
                    ]
                }
                const nodesMap = new NodesMap(pipeline);
                const node = nodesMap._virtualGraph.findByTarget('black');
                const link0 = node.links[0];
                const link1 = node.links[1];

                expect(link0.source).to.equal('green');
                expect(link0.target).to.equal('black');
                expect(link1.source).to.equal('yellow');
                expect(link1.target).to.equal('black');

            });
            it('should find Virtual node By edge', function () {
                const pipeline = {
                    "nodes": [
                        {
                            "nodeName": "green",
                            "algorithmName": "green-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "yellow",
                            "algorithmName": "yellow-alg",
                            "input": [
                                "#@flowInput.files.links"
                            ]
                        },
                        {
                            "nodeName": "black",
                            "algorithmName": "black-alg",
                            "input": [
                                "*@green",
                                "*@yellow",
                                "@green",
                                "@yellow"
                            ]
                        }
                    ]
                }
                const nodesMap = new NodesMap(pipeline);
                const node = nodesMap._virtualGraph.findByEdge('green', 'black');
                const link0 = node.links[0];
                const link1 = node.links[1];

                expect(link0.source).to.equal('green');
                expect(link0.target).to.equal('black');
                expect(link1.source).to.equal('yellow');
                expect(link1.target).to.equal('black');

            });
            it('should create virtualGraph with multi input types', function () {
                const pipeline = pipelines.find(p => p.name === 'multi-input');
                const nodesMap = new NodesMap(pipeline);
                const link0 = nodesMap._virtualGraph.list[0].links[0];
                const link1 = nodesMap._virtualGraph.list[0].links[1];
                expect(link0.edges).to.have.lengthOf(3);
                expect(link1.edges).to.have.lengthOf(3);

                expect(link0.source).to.equal('green');
                expect(link0.target).to.equal('black');
                expect(link1.source).to.equal('yellow');
                expect(link1.target).to.equal('black');
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
            it('parentsResults: should return all nodes', function () {
                const pipeline = clone(pipelines[0]);
                const green = pipeline.nodes[0];
                const yellow = pipeline.nodes[1];
                const nodesMap = new NodesMap(pipeline);
                nodesMap.setNode(new Node({
                    nodeName: green.nodeName,
                    algorithmName: green.algorithmName,
                    result: { my: 'OK' }
                }));
                const result = nodesMap.parentsResults(yellow.nodeName);
                expect(result).to.have.property(green.nodeName);
            });
            it('isAllParentsFinished: should return false', function () {
                const pipeline = clone(pipelines[0]);
                const yellow = pipeline.nodes[1];
                const nodesMap = new NodesMap(pipeline);
                const result = nodesMap.isAllParentsFinished(yellow.nodeName);
                expect(result).to.equal(false);
            });
            it('nodesResults: should return array', function () {
                const pipeline = clone(pipelines[0]);
                const nodesMap = new NodesMap(pipeline);
                const result = nodesMap.nodesResults();
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
    describe('Progress', function () {
        it('should call progress with level silly', function () {
            const jobId = `jobid-${uuidv4()}`;
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_throttledProgress");
            prog.silly({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('silly');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level debug', function () {
            const jobId = `jobid-${uuidv4()}`;
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_throttledProgress");
            prog.debug({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('debug');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level info', function () {
            const jobId = `jobid-${uuidv4()}`;
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.info({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('info');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level warning', function () {
            const jobId = `jobid-${uuidv4()}`;
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.warning({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('warning');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level error', function () {
            const jobId = `jobid-${uuidv4()}`;
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.error({ jobId, status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('error');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
        it('should call progress with level critical', function () {
            const jobId = `jobid-${uuidv4()}`;
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.critical({ jobId, status: data.status })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('critical');
            expect(call.args[1].jobId).to.equal(jobId);
            expect(call.args[1].status).to.equal(data.status);
        });
    });
    describe('StateManager', function () {
        it('set/get/TaskState', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const task = new Node({
                taskId: 'taskId-test',
                nodeName: 'nodeName-test',
                algorithmName: 'algorithm-test',
                status: 'completed'
            })
            await stateManager.setTaskState({ jobId, taskId: task.taskId, data: task });
            const response = await stateManager.getTaskState({ jobId, taskId: task.taskId });
            expect(response.taskId).to.equal(task.taskId);
        });
        it('set/get/DriverState', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'completed' };
            await stateManager.setDriverState({ jobId, data });
            const response = await stateManager.getDriverState({ jobId });
            expect(response.state).to.deep.equal(data);
        });
        it('setJobResults', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { result: [1, 2, 3] };
            await stateManager.setJobResults({ jobId, data });
            const response = await stateManager._etcd.jobResults.getResults({ jobId });
            expect(response.data).to.deep.equal(data);
        });
        it('setJobStatus', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'completed' };
            await stateManager.setJobStatus({ jobId, data });
            const response = await stateManager._etcd.jobResults.getStatus({ jobId });
            expect(response.data).to.deep.equal(data);
        });
        it('getState', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const task = new Node({
                taskId: 'taskId-test',
                nodeName: 'nodeName-test',
                algorithmName: 'algorithm-test',
                status: 'completed'
            })
            const data = { status: 'completed' };
            await stateManager.setDriverState({ jobId, data });
            await stateManager.setTaskState({ jobId, taskId: task.taskId, data: task });
            const response = await stateManager.getState({ jobId });
            expect(response).to.have.property('driverTasks');
            expect(response).to.have.property('jobTasks');
            expect(response).to.have.property('startTime');
            expect(response).to.have.property('state');
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
            await stateManager._etcd.jobs.stop({ jobId });
        });
        it('unWatchJobState', async function () {
            const jobId = `jobid-${uuidv4()}`;
            await stateManager.watchJobState({ jobId });
            stateManager.on(Events.JOBS.STOP, (response) => {
                throw new Error('failed');
            });
            const response = await stateManager.unWatchJobState({ jobId });
            await stateManager._etcd.jobs.stop({ jobId });
            setTimeout(() => {
                done();
            }, 1000)
        });
        it('getDriverTasks', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const task = new Node({
                taskId: 'taskId-test',
                nodeName: 'nodeName-test',
                algorithmName: 'algorithm-test',
                status: 'completed'
            })
            await stateManager.setTaskState({ jobId, taskId: task.taskId, data: task });
            const response = await stateManager.getDriverTasks({ jobId });
            expect(response[0].nodeName).to.equal(task.nodeName);
            expect(response[0].algorithmName).to.equal(task.algorithmName);
        });
    });
});
