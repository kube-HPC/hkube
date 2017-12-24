
process.env.NODE_PATH = process.cwd();
require('module').Module._initPaths();

const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
const configIt = require('@hkube/config');
const clone = require('clone');
const { expect } = require('chai');
const sinon = require('sinon');
const Events = require('lib/consts/Events');
const Batch = require('lib/nodes/node-batch');
const Node = require('lib/nodes/node');
const Task = require('lib/tasks/Task');
const bootstrap = require('../bootstrap');
const producer = require('lib/producer/jobs-producer');
const consumer = require('lib/consumer/jobs-consumer');
const stateManager = require('lib/state/state-manager');
const inputParser = require('lib/parsers/input-parser');
const progress = require('lib/progress/nodes-progress');
const NodesMap = require('lib/nodes/nodes-map');
const WorkerStub = require('test/mocks/worker');
const pipelines = require('test/mocks/pipelines');

describe('Test', function () {
    before(async () => {
        await bootstrap.init();
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
        describe('Validation', function () {
            it('should not throw error', function () {
                consumer.init();
            });
        });
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
    describe('NodesMap', function () {
        it('findEntryNodes: should find entry nodes', function (done) {
            const firstNode = pipelines[0].nodes[0];
            const nodesMap = new NodesMap(pipelines[0]);
            const entryNodes = nodesMap.findEntryNodes();
            expect(entryNodes[0]).to.equal(firstNode.nodeName);
            done();
        });
        it('getNode: should get node by name', function (done) {
            const firstNode = pipelines[0].nodes[0];
            const nodesMap = new NodesMap(pipelines[0]);
            const node = nodesMap.getNode(firstNode.nodeName);
            expect(node.nodeName).to.equal(firstNode.nodeName);
            done();
        });
        it('getNode: should not get node by name', function (done) {
            const nodesMap = new NodesMap(pipelines[0]);
            const node = nodesMap.getNode('not_exists');
            expect(node).to.be.undefined;
            done();
        });
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
                batchID: `${node.nodeName}#1`,
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
            nodesMap.setNode(node.nodeName, new Node({
                nodeName: node.nodeName,
                algorithmName: node.algorithmName,
                result: result
            }));
            const results = nodesMap.getNodeResults(node.nodeName);
            expect(results[0]).to.deep.equal(result);
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
                batchID: `${node.nodeName}#1`
            })
            nodesMap.addBatch(batch);
            nodesMap.updateTaskState(batch.taskId, options);
            const states = nodesMap.getNodeStates(node.nodeName);
            expect(states[0]).to.equal(options.status);
        });
        it('isAllNodesDone: should return false', function () {
            const pipeline = clone(pipelines[0]);
            const node = pipeline.nodes[0];
            const nodesMap = new NodesMap(pipeline);
            nodesMap.addBatch(new Batch({
                nodeName: node.nodeName,
                batchID: `${node.nodeName}#1`,
                status: 'complete',
            }));
            const result = nodesMap.isAllNodesDone();
            expect(result).to.equal(false);
        });
        it('getAllNodes: should return all nodes', function () {
            const pipeline = clone(pipelines[0]);
            const node = pipeline.nodes[0];
            const nodesMap = new NodesMap(pipeline);
            nodesMap.addBatch(new Batch({
                nodeName: node.nodeName,
                batchID: `${node.nodeName}#1`,
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
            nodesMap.setNode(green.nodeName, new Node({
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
        it('calc: should calc progress', function () {
            const pipeline = clone(pipelines[0]);
            const nodesMap = new NodesMap(pipeline);
            const result = nodesMap.calc();
            expect(result).to.have.property('progress');
            expect(result).to.have.property('details');
            expect(result.progress).to.equal('0.00');
            expect(result.details).to.equal('0.00% completed, 4 creating');
        });
    });
    describe('Parsers', function () {
        it('should parse input as batch', function () {
            const pipeline = pipelines[1];
            const links = pipeline.flowInput.files.links.map(f => new Array(f));
            const firstNode = pipeline.nodes[0];
            const options = Object.assign({}, { flowInput: pipeline.flowInput }, { input: firstNode.input });
            const result = inputParser.parse(options, firstNode.input, {});
            expect(result.input).to.deep.equal(links);
        });
        it('should parse input as raw batch', function () {
            const pipeline = pipelines.find(p => p.name === 'rawBatch');
            const array = [1, 2, 3, 4, 5].map(i => new Array(1).fill(i, 0, 1));
            const firstNode = pipeline.nodes[0];
            const options = Object.assign({}, { flowInput: pipeline.flowInput }, { input: firstNode.input });
            const result = inputParser.parse(options, firstNode.input, {});
            expect(result.input).to.deep.equal(array);
        });
        it('should parse node result to batch', function () {
            const pipeline = pipelines.find(p => p.name === 'resultBatch');
            const yellow = pipeline.nodes[1];
            const greenResults = { green: [1, 2, 3, 4, 5] };
            const options = Object.assign({}, { flowInput: pipeline.flowInput }, { input: yellow.input });
            const result = inputParser.parse(options, yellow.input, greenResults);
            expect(result.batch).to.equal(true);
            expect(result.input).to.have.lengthOf(5);
        });
        it('should extract nodes from input', function () {
            const pipeline = pipelines[1];
            const lastNode = pipeline.nodes[2];
            const nodeNames = pipeline.nodes.map(n => n.nodeName).slice(0, 2);
            const nodes = inputParser.extractNodesFromInput(lastNode.input);
            expect(nodes).to.deep.equal(nodeNames);
        });
        it('should return true when is batch', function () {
            const pipeline = pipelines[1];
            const firstNode = pipeline.nodes[0];
            const result = inputParser.isBatch(firstNode.input[0]);
            expect(result).to.equal(true);
        });
        it('should return false when is not batch', function () {
            const pipeline = pipelines[1];
            const node = pipeline.nodes[1];
            const result = inputParser.isBatch(node.input[0]);
            expect(result).to.equal(false);
        });
        it('should return true when is node', function () {
            const pipeline = pipelines[1];
            const node = pipeline.nodes[1];
            const result = inputParser.isNode(node.input[0]);
            const nodeName = node.input[0].substr(1);
            expect(result.isNode).to.equal(true);
            expect(result.node).to.equal(nodeName);
        });
        it('should return false when is not node', function () {
            const pipeline = pipelines[1];
            const node = pipeline.nodes[0];
            const result = inputParser.isNode(node.input[0]);
            expect(result.isNode).to.equal(false);
        });
        it('should return true when is flowInput', function () {
            const pipeline = pipelines[0];
            const node = pipeline.nodes[0];
            const result = inputParser.isFlowInput(node.input[0]);
            expect(result).to.equal(true);
        });
        it('should return false when is not flowInput', function () {
            const pipeline = pipelines[0];
            const node = pipeline.nodes[1];
            const result = inputParser.isFlowInput(node.input[0]);
            expect(result).to.equal(false);
        });
        it('should return true when is reference', function () {
            const pipeline = pipelines[0];
            const node = pipeline.nodes[1];
            const result = inputParser.isReference(node.input[0]);
            expect(result).to.equal(true);
        });
        it('should return false when is not reference', function () {
            const pipeline = pipelines[0];
            const node = pipeline.nodes[3];
            const result = inputParser.isReference(node.input[0]);
            expect(result).to.equal(false);
        });
    });
    describe('Progress', function () {
        it('should call progress with level silly', function () {
            const jobId = `jobid-${uuidv4()}`;
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
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
            const spy = sinon.spy(prog, "_progress");
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
            const response = await stateManager.setJobResults({ jobId, data });
            expect(JSON.parse(response.node.value).data).to.deep.equal(data);
        });
        it('setJobStatus', async function () {
            const jobId = `jobid-${uuidv4()}`;
            const data = { status: 'completed' };
            const response = await stateManager.setJobStatus({ jobId, data });
            expect(JSON.parse(response.node.value).data).to.deep.equal(data);
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
                expect(response.jobId).to.equal(jobId);
                expect(response.state).to.equal('stop');
                done();
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
