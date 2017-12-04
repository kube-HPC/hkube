
process.env.NODE_PATH = process.cwd();
require('module').Module._initPaths();

const uuidv4 = require('uuid/v4');
const { Producer } = require('@hkube/producer-consumer');
const configIt = require('@hkube/config');
const clone = require('clone');
const { expect } = require('chai');
const sinon = require('sinon');
const producer = require('lib/producer/jobs-producer');
const consumer = require('lib/consumer/jobs-consumer');
const stateManager = require('lib/state/state-manager');
const inputParser = require('lib/parsers/input-parser');
const progress = require('lib/progress/nodes-progress');
const NodesMap = require('lib/nodes/nodes-map');
const WorkerStub = require('test/mocks/worker');
const pipelines = require('test/mocks/pipelines');
let config, jobId = null;

describe('Test', function () {
    before(async () => {
        jobId = `jobid-${uuidv4()}`;
        const { main } = await configIt.load();
        config = main;
        await producer.init(config);
        await consumer.init(config);
        stateManager.init(config);
        stateManager.setCurrentJobID(jobId);
        await stateManager.watchTasks();
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
            it('should create job fire event task-failed', function (done) {
                const options = {
                    type: 'test-job-task-failed',
                    jobId: jobId,
                    taskId: `taskId-${uuidv4()}`
                }
                stateManager.on('task-failed', (data) => {
                    expect(data).to.have.property('jobId');
                    expect(data).to.have.property('taskId');
                    expect(data).to.have.property('error');
                    expect(data).to.have.property('status');
                    done();
                });
                const worker = new WorkerStub(options);
                producer.createJob(options);
                setTimeout(() => {
                    worker.done(null, new Error('fake error'));
                }, 1000)
            });
            it('should create job fire event task-completed', function (done) {
                const options = {
                    type: 'test-job-task-completed',
                    jobId: jobId,
                    taskId: `taskId-${uuidv4()}`
                }
                stateManager.on('task-completed', (data) => {
                    expect(data).to.have.property('jobId');
                    expect(data).to.have.property('taskId');
                    expect(data).to.have.property('result');
                    expect(data).to.have.property('status');
                    done();
                });
                const worker = new WorkerStub(options);
                producer.createJob(options);
                setTimeout(() => {
                    worker.done({ state: 'OK' });
                }, 1000)
            });
            it('should create job fire event task-waiting', function (done) {
                let count = 0;
                const taskId = `taskId-${uuidv4()}`;
                const options = { type: 'test-job-task-waiting', jobId, taskId }
                producer.on('task-waiting', (task) => {
                    if (count === 0) {
                        count++;
                        done();
                    }
                })
                const worker = new WorkerStub(options);
                producer.createJob(options);
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
            it('should consume a job with properties', function (done) {
                const data = { test: 'OK' };
                consumer.on('job-start', async (job) => {
                    expect(job.data).to.deep.equal(data);
                    done();
                });
                const setting = {
                    prefix: 'jobs-pipeline'
                }
                const options = {
                    job: {
                        type: 'pipeline-driver-job',
                        data: data
                    }
                }
                const p = new Producer({ setting: setting });
                p.createJob(options);
            });
        });
    });
    describe('NodesMap', function () {
        it('should find entry nodes', function (done) {
            const firstNode = pipelines[0].nodes[0];
            const nodesMap = new NodesMap(pipelines[0]);
            const entryNodes = nodesMap.findEntryNodes();
            expect(entryNodes[0]).to.equal(firstNode.nodeName);
            done();
        });
        it('should get node by name', function (done) {
            const firstNode = pipelines[0].nodes[0];
            const nodesMap = new NodesMap(pipelines[0]);
            const node = nodesMap.getNode(firstNode.nodeName);
            expect(node.name).to.equal(firstNode.nodeName);
            done();
        });
        it('should not get node by name', function (done) {
            const nodesMap = new NodesMap(pipelines[0]);
            const node = nodesMap.getNode('not_exists');
            expect(node).to.be.undefined;
            done();
        });
        it('should throw error when no nodes', function () {
            expect(() => new NodesMap()).to.throw(`pipeline must have nodes`);
        });
        it('should not able to get node results', function () {
            const nodesMap = new NodesMap(pipelines[0]);
            expect(() => nodesMap.getNodeResults('not_exists')).to.throw(`unable to find node not_exists`);
        });
        it('should not able to update node state', function () {
            const nodesMap = new NodesMap(pipelines[0]);
            expect(() => nodesMap.updateNodeState('not_exists')).to.throw(`unable to find node not_exists`);
        });
        it('should not able to get node states', function () {
            const nodesMap = new NodesMap(pipelines[0]);
            expect(() => nodesMap.getNodeStates('not_exists')).to.throw(`unable to find node not_exists`);
        });
        it('should get all nodes', function () {
            const nodesMap = new NodesMap(pipelines[0]);
            const nodes = nodesMap.getAllNodes();
            expect(nodes).to.have.lengthOf(4);
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
    describe('progress', function () {
        it('should call progress with level silly', function () {
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.silly({ status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('silly');
            expect(call.args[1]).to.deep.equal(data);

        });
        it('should call progress with level debug', function () {
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.debug({ status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('debug');
            expect(call.args[1]).to.deep.equal(data);
        });
        it('should call progress with level info', function () {
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.info({ status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('info');
            expect(call.args[1]).to.deep.equal(data);
        });
        it('should call progress with level warning', function () {
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.warning({ status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('warning');
            expect(call.args[1]).to.deep.equal(data);
        });
        it('should call progress with level error', function () {
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.error({ status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('error');
            expect(call.args[1]).to.deep.equal(data);
        });
        it('should call progress with level critical', function () {
            const prog = clone(progress);
            const data = { status: 'active' };
            const spy = sinon.spy(prog, "_progress");
            prog.critical({ status: 'active' })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0]).to.equal('critical');
            expect(call.args[1]).to.deep.equal(data);
        });
    });
});
