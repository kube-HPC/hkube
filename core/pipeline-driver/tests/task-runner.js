const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const Etcd = require('@hkube/etcd');
const { NodesMap, NodeTypes } = require('@hkube/dag');
const { Node } = NodeTypes;
const pipelines = require('./mocks/pipelines');
const GraphStore = require('../lib/datastore/graph-store');
const WorkerStub = require('./mocks/worker')
const { delay, createJobId } = require('./utils');
const graphStore = new GraphStore();
let config, stateManager, taskRunner, TaskRunner, consumer;

describe('TaskRunner', function () {
    before(async () => {
        config = testParams.config;
        stateManager = require('../lib/state/state-manager');
        TaskRunner = require('../lib/tasks/task-runner');
        consumer = require('../lib/consumer/jobs-consumer');
    });
    beforeEach(function () {
        taskRunner = new TaskRunner(config);
    });
    it('should throw exception and stop pipeline', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const error = `unable to find pipeline for job ${jobId}`;
        const spy = sinon.spy(taskRunner, "stop");
        await taskRunner.start(job)
        const call = spy.getCalls()[0];
        expect(spy.calledOnce).to.equal(true);
        expect(call.args[0].error.message).to.equal(error);
    });
    it('should start only one pipeline', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'two-nodes');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        const res1 = await taskRunner.start(job);
        const res2 = await taskRunner.start(job);
        expect(res1.name).to.equal('two-nodes');
        expect(res2).to.be.null;
    });
    it('should start pipeline successfully', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'flow2');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        await taskRunner.start(job)
        expect(taskRunner._jobId).to.equal(jobId);
        expect(taskRunner._active).to.equal(true);
        expect(taskRunner.pipeline.name).to.equal(pipeline.name);
        const statusFromEtcd = await stateManager._etcd.jobs.status.get({ jobId });
        expect(statusFromEtcd.activeTime).to.exist;
        const statusFromDb = await stateManager.getJobStatus({ jobId });
        expect(statusFromDb.activeTime).to.exist;

    });
    it('should recover pipeline successfully', async function () {
    });
    it('should throw when check batch tolerance', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'batch');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        await taskRunner.start(job);
        await delay(500);
        const node = taskRunner._nodes.getNode('green');
        const length = node.batch.length - 1;
        for (let i = 0; i < length; i++) {
            taskRunner._nodes.updateTaskState(node.batch[i].taskId, { status: 'failed', error: 'oooohh noooo' });
        }
        const result = taskRunner._checkTaskErrors(node.batch[0]);
        expect(result.message).to.equal(`${length}/5 (80%) failed tasks, batch tolerance is 60%, error: oooohh noooo`);
    });
    it('should recover existing pipeline', async function () {
        const jobId = createJobId();
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
        const status = { status: 'active' };
        const activeTime = Date.now();
        await stateManager.createJob({ jobId, pipeline, status });
        await stateManager.updatePipeline({ jobId, activeTime });
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node1.taskId, status: 'succeed' });
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node2.taskId, status: 'succeed' });
        const spy = sinon.spy(taskRunner, "_recoverPipeline");
        await graphStore.start(job.data.jobId, nodesMap);
        await taskRunner.start(job)
        expect(spy.calledOnce).to.equal(true);
        expect(taskRunner.pipeline.activeTime).to.equal(activeTime);
    });
    it.skip('should recover succeed tasks', async function () {
        const jobId = `jobid-recovery-${createJobId()}`;
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'simple-flow');
        const nodesMap = new NodesMap(pipeline);
        const node1 = new Node(pipeline.nodes[0]);
        const node2 = new Node(pipeline.nodes[1]);
        const node3 = new Node(pipeline.nodes[2]);
        const node4 = new Node(pipeline.nodes[3]);
        nodesMap.setNode(node1);
        nodesMap.setNode(node2);
        nodesMap.setNode(node3);
        nodesMap.setNode(node4);

        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node1.taskId, status: 'active' });
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node2.taskId, status: 'active' });
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node3.taskId, status: 'active' });
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node4.taskId, status: 'active' });
        const status = { status: 'active' };
        await stateManager.createJob({ jobId, pipeline, status });
        await graphStore.start(jobId, nodesMap);
        await consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        expect(driver._active).to.equal(true);

        // simulate restart
        await driver.onStop({});
        expect(driver._active).to.equal(false, 'onStop failed');
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node1.taskId, status: 'succeed' });
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node2.taskId, status: 'succeed' });
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node3.taskId, status: 'succeed' });
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId: node4.taskId, status: 'succeed' });
        await driver.start(job);
        await delay(2000);
        expect(driver._active).to.equal(false);
    });
    it('should create job and handle success after stalled status', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'one-node');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        const promise = consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        const spy = sinon.spy(driver, "stop");
        await promise;
        const node = driver._nodes.getNode('green');
        const taskId = node.taskId;
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId, error: 'taskStalled', status: 'stalled' });
        await delay(300);
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId, status: 'succeed' });
        await delay(300);
        expect(spy.calledOnce).to.equal(true);
    });
    it('should create job and handle failed after stalled status', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'one-node');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        const promise = consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        const spy = sinon.spy(driver, "stop");
        await promise;
        const node = driver._nodes.getNode('green');
        const taskId = node.taskId;
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId, error: 'taskStalled', status: 'stalled' });
        await delay(300);
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId, status: 'failed' });
        await delay(300);
        expect(spy.calledOnce).to.equal(true);
    });
    it('should create job and handle board update', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }

        const pipeline = pipelines.find(p => p.name === 'one-node');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        await consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        const { taskId } = driver._nodes.getNode('green');
        await stateManager._etcd.jobs.tasks.set({ jobId, taskId, status: 'active', metricsPath: { tensorboard: { path: 'path' } } });
        await delay(300);
        const pipe = await stateManager.getExecution({ jobId });
        expect(pipe.types).to.eql(['tensorboard']);
    });
    it.skip('should wait any', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'simple-wait-any');
        await stateManager.createJob({ jobId, pipeline, status: { status: 'pending' } });
        await consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        await delay(300);
        const options = { type: 'test-job' };
        const workerStub = new WorkerStub(options);
        const status = 'succeed';
        const result = 42;
        const green = driver._nodes.getNode('green');
        const yellow = driver._nodes.getNode('yellow');
        const black = driver._nodes.getNode('black');
        await workerStub.done({ jobId, taskId: green.batch[0].taskId, status, result, nodeName: 'green', batchIndex: green.batch[0].batchIndex });
        await workerStub.done({ jobId, taskId: yellow.batch[0].taskId, status, result, nodeName: 'yellow', batchIndex: yellow.batch[0].batchIndex });

        await delay(300);

        expect(black.status).to.equals('preschedule');
        expect(black.batch[0].input).to.lengthOf(2);
    });
    it('should start pipeline and update graph on failure', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === "simple-flow");
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        await consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        await driver.stop({ error: 'error' });
        const graph = await graphStore.getGraph({ jobId });
        expect(graph.nodes[0].status).to.equal('stopped');
        expect(graph.nodes[1].status).to.equal('stopped');
        expect(graph.nodes[2].status).to.equal('stopped');
        expect(graph.nodes[3].status).to.equal('stopped');
    });
    it('should start pipeline and handle insufficient mem warning', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'flow2');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        await consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        await delay(500);
        const node = driver._nodes.getNode('green');
        const algorithmName = node.algorithmName;
        const discovery = {
            unScheduledAlgorithms: {
                [algorithmName]: {
                    algorithmName: algorithmName,
                    type: "warning",
                    reason: "FailedScheduling",
                    hasMaxCapacity: false,
                    message: "Insufficient mem (4)",
                    timestamp: 1593926212391,
                    complexResourceDescriptor: {
                        requestedSelectors: [
                            "mock-selector = mock-value"
                        ],
                        "nodes": [
                            {
                                "nodeName" : "mockNodeName1",
                                "amountsMissing": {
                                    "mem" : 0.1
                                },
                                "requestsOverMaxCapacity": []
                            },
                            {
                                "nodeName" : "mockNodeName2",
                                "amountsMissing": {
                                    "mem" : 512
                                },
                                "requestsOverMaxCapacity": []
                            },
                            {
                                "nodeName" : "mockNodeName3",
                                "amountsMissing": {
                                    "mem" : 1024
                                },
                                "requestsOverMaxCapacity": []
                            },
                            {
                                "nodeName" : "mockNodeName4",
                                "amountsMissing": {
                                    "mem" : 256
                                },
                                "requestsOverMaxCapacity": []
                            }
                        ],
                    }
                }
            }
        }
        const etcd = new Etcd(config.etcd);
        await etcd.discovery.register({ serviceName: 'task-executor', data: discovery });
        await delay(2000);
        const algorithm = discovery.unScheduledAlgorithms[algorithmName];
        expect(node.status).to.equal(algorithm.reason);
        expect(node.batch[0].status).to.equal(algorithm.reason);
        expect(node.warnings[0]).to.equal('Insufficient mem (4)\nNode: mockNodeName1 -  missing resources: mem = 0.1,\nNode: mockNodeName2 -  missing resources: mem = 512,\nNode: mockNodeName3 -  missing resources: mem = 1024,\nNode: mockNodeName4 -  missing resources: mem = 256');
    });
    it('should start pipeline and handle maximum capacity exceeded - produce warning', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'flow2');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        await consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        const node = driver._nodes.getNode('green');
        const algorithmName = node.algorithmName;
        const discovery = {
            unScheduledAlgorithms: {
                [algorithmName]: {
                    algorithmName: algorithmName,
                    type: 'warning',
                    reason: 'FailedScheduling',
                    hasMaxCapacity: true,
                    message: 'Maximum capacity exceeded cpu (4)',
                    timestamp: Date.now(),
                    requestedResources: {
                      cpu: 2  
                    },
                    complexResourceDescriptor: {
                        "nodes": [
                            {
                                nodeName : 'node1',
                                requestsOverMaxCapacity: [['cpu', true]]
                            },
                            {
                                nodeName : 'node2',
                                requestsOverMaxCapacity: [['cpu', true]]
                            },
                            {
                                nodeName : 'node3',
                                requestsOverMaxCapacity: [['cpu', true]]
                            },
                            {
                                nodeName : 'node4',
                                requestsOverMaxCapacity: []
                            },
                        ],
                        
                    }
                }
            },
            nodes: [
                {
                    "name" : "node1",
                    "total" : {
                        "cpu" : 1
                    }
                },
                {
                    "name" : "node2",
                    "total" : {
                        "cpu" : 1
                    }
                },
                {
                    "name" : "node3",
                    "total" : {
                        "cpu" : 1
                    }
                },
                {
                    "name" : "node4",
                    "total" : {
                        "cpu" : 1
                    }
                }
            ]
        }
        const etcd = new Etcd(config.etcd);
        await etcd.discovery.register({ serviceName: 'task-executor', data: discovery });
        await delay(2000);
        const algorithm = discovery.unScheduledAlgorithms[algorithmName];
        expect(node.status).to.equal(algorithm.reason);
        expect(node.batch[0].status).to.equal(algorithm.reason);
        expect(node.warnings.length).to.equal(1);
    });
    it('should start pipeline and handle maximum capacity exceeded - produce error', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'flow2');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        await consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        const node = driver._nodes.getNode('green');
        const algorithmName = node.algorithmName;
        const discovery = {
            unScheduledAlgorithms: {
                [algorithmName]: {
                    algorithmName: algorithmName,
                    type: 'warning',
                    reason: 'FailedScheduling',
                    hasMaxCapacity: true,
                    message: 'Maximum capacity exceeded cpu (4)',
                    timestamp: Date.now(),
                    requestedResources: {
                      cpu: 2  
                    },
                    complexResourceDescriptor: {
                        "nodes": [
                            {
                                nodeName : 'node1',
                                requestsOverMaxCapacity: [['cpu', true]]
                            },
                            {
                                nodeName : 'node2',
                                requestsOverMaxCapacity: [['cpu', true]]
                            },
                            {
                                nodeName : 'node3',
                                requestsOverMaxCapacity: [['cpu', true]]
                            },
                            {
                                nodeName : 'node4',
                                requestsOverMaxCapacity: [['cpu', true]]
                            },
                        ],
                        
                    }
                }
            },
            nodes: [
                {
                    "name" : "node1",
                    "total" : {
                        "cpu" : 1
                    },
                    "name" : "node2",
                    "total" : {
                        "cpu" : 1
                    },
                    "name" : "node3",
                    "total" : {
                        "cpu" : 1
                    },
                    "name" : "node4",
                    "total" : {
                        "cpu" : 1
                    }
                }

            ]
        }
        const etcd = new Etcd(config.etcd);
        await etcd.discovery.register({ serviceName: 'task-executor', data: discovery });
        await delay(2000);
        const algorithm = discovery.unScheduledAlgorithms[algorithmName];
        expect(node.status).to.equal(algorithm.reason);
        expect(node.batch[0].status).to.equal(algorithm.reason);
        expect(node.warnings.length).to.equal(0);
    });
    it('should run stateful nodes at start', async function () {
        const jobId = createJobId();
        const job = {
            data: { jobId },
            done: () => { }
        }
        const pipeline = pipelines.find(p => p.name === 'stateful-pipeline');
        const status = { status: 'pending' };
        await stateManager.createJob({ jobId, pipeline, status });
        await consumer._handleJob(job);
        const driver = consumer._drivers.get(jobId);
        await delay(2000);
        const allNodes = pipeline.nodes.map(n => n.nodeName);
        const entryNodes = driver._findEntryNodes();
        expect(entryNodes.sort()).to.eql(allNodes.sort());
    });
});