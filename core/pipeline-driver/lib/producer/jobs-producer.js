const EventEmitter = require('events');
const validate = require('djsv');
const { Producer } = require('producer-consumer.rf');
const schema = require('lib/producer/schema');
const consumer = require('lib/consumer/jobs-consumer');
const stateManager = require('lib/state/state-manager');
const NodesHandler = require('lib/nodes/nodes-handler');
const States = require('lib/state/States');
const NodeState = require('lib/state/NodeState');
const inputParser = require('lib/parsers/input-parser');
const Batch = require('lib/nodes/batch');
const Logger = require('logger.rf');
const log = Logger.GetLogFromContainer();
const components = require('common/consts/componentNames');
const url = require('url');

class JobProducer extends EventEmitter {

    constructor() {
        super();
        this._job = null;
        this._producer = null;
        this._nodes = null;
    }

    init(options) {
        const setting = Object.assign({}, { redis: options.redis });
        const res = validate(schema.properties.setting, setting);
        if (!res.valid) {
            throw new Error(res.errors[0].stack);
        }

        this._producer = new Producer({ setting: setting });
        this._producer.on('job-waiting', (data) => {
            log.info(`job waiting ${data.jobID}`, { component: components.JOBS_PRODUCER });
            const internal = data.options.internalData;
            const node = new NodeState({
                nodeName: internal.nodeName,
                batchID: internal.batchID,
                status: States.PENDING
            });
            this._setTaskState(data.jobID, node);
        }).on('job-active', (data) => {
            log.info(`job active ${data.jobID}`, { component: components.JOBS_PRODUCER });
            const internal = data.options.internalData;
            const node = new NodeState({
                nodeName: internal.nodeName,
                batchID: internal.batchID,
                status: States.ACTIVE
            });
            this._setTaskState(data.jobID, node);
        }).on('job-completed', (data) => {
            // log.info(`job completed ${data.jobID}`, { component: components.JOBS_PRODUCER });
        }).on('job-failed', (data) => {
            log.error(`job failed ${data.jobID}, error: ${data.error}`, { component: components.JOBS_PRODUCER });
            const internal = data.options.internalData;
            const node = new NodeState({
                nodeName: internal.nodeName,
                batchID: internal.batchID,
                error: data.error,
                status: States.FAILED
            });
            this._setTaskState(data.jobID, node);
            this._jobDone(data.error);
        });

        consumer.on('job-stop', async (job) => {
            let state = await stateManager.getState();
            this._onJobStop(state);
        });
        consumer.on('job-start', (job) => {
            this._onJobStart(job);
        });
    }

    async _watchWorker(options) {
        await stateManager.onTaskResult({ taskId: options.taskId }, (result) => {
            const node = new NodeState({
                nodeName: options.nodeName,
                batchID: options.batchID,
                result: result,
                status: States.COMPLETED
            });
            log.info(`job completed ${options.taskId}`, { component: components.JOBS_PRODUCER });
            this._setTaskState(options.taskId, node);
            this._runCompleted(node.nodeName);
        });
    }

    _runCompleted(nodeName) {
        const childs = this._nodes.childs(nodeName);
        childs.forEach(child => {
            const node = this._nodes.getNode(child);
            const waitAnyIndex = inputParser.waitAnyInputIndex(node.input);
            if (waitAnyIndex > -1) {
                this._runWaitAny(child, data.result);
            }
            else {
                const allFinished = this._nodes.isAllParentsFinished(child);
                if (allFinished) {
                    const results = this._nodes.parentsResults(child);
                    this._runNode(child, results);
                }
            }
        });
        this._jobDone();
    }

    _runNode(nodeName, nodesInput) {
        const node = this._nodes.getNode(nodeName);
        const options = Object.assign({}, { flowInput: this._job.data.flowInput }, { input: node.input });
        const result = inputParser.parse(options, node.input, nodesInput);
        this._runNodeInner(node, result);
    }

    _runNodeInner(node, data) {
        if (data.batch) {
            this._runBatch(node.name, data.input);
        }
        else {
            this._nodes.setNode(node.name, { input: data.input });
            this._createJob(node);
        }
    }

    _runBatch(nodeName, batchArray) {
        const node = this._nodes.getNode(nodeName);
        if (!Array.isArray(batchArray)) {
            throw new Error(`node ${nodeName} batch input must be an array`);
        }
        const options = Object.assign({}, this._job.data, node);
        batchArray.forEach((inp, ind) => {
            const batch = new Batch({
                name: node.name,
                batchID: `${node.name}#${(ind + 1)}`,
                algorithm: node.algorithm,
                input: inp
            });
            this._nodes.addBatch(batch);
            this._createJob(batch);
        })
    }

    _runWaitAny(nodeName, nodeInput) {
        const node = this._nodes.getNode(nodeName);
        const waitAnyIndex = inputParser.waitAnyInputIndex(node.input);
        const input = node.input.slice();
        input.forEach((inp, ind) => {
            if (inputParser.isWaitAnyBatch(inp)) {
                const nodeInput = node.input[waitAnyIndex].substr(2);
                this._runBatch(nodeName, nodeInput, waitAnyIndex);
            }
            else if (inputParser.isWaitAnyNode(inp)) {
                const ndName = node.input[waitAnyIndex].substr(2);
                const result = inputParser.extractObject(ndName);
                input[waitAnyIndex] = inputParser.parseValue(nodeInput, result.path);
            }
            else if (inputParser.isNode(inp)) {
                const ndName = node.input[ind].substr(1);
                const result = inputParser.extractObject(ndName);
                input[ind] = inputParser.parseValue(nodeInput, result.path);
            }
        });
        this._nodes.setNode(node.name, { input: input });
        this._createJob(node);
    }

    _jobDone(error) {
        if (error) {
            this._job.done(error);
        }
        else if (this._nodes.isAllNodesDone()) {
            log.info(`pipeline completed ${this._job.id}`, { component: components.JOBS_PRODUCER });
            const res = this._nodes.allNodesResults();
            stateManager.setJobResults({ data: { result: res, webhook: this._job.data.webhook } });
            this._job.done(null);
        }
    }

    _getNodeOutput(node) {
        const nodeName = node.substr(1);
        const result = inputParser.extractObject(nodeName);
        const results = this._nodes.getNodeResults(result.object);
        const output = results.map(r => inputParser.parseValue(r, result.path));
        return output;
    }

    async _onJobStart(job) {
        log.info(`job arrived ${job.id}`, { component: components.JOBS_CONSUMER });
        this._job = job;
        this._nodes = new NodesHandler(job.data);
        stateManager.updateInit(job.id);

        // first we will try to get the state for this job
        const state = await stateManager.getState();
        if (state) {
            if (state.state === States.STOPPED) {
                this._onJobStop(state);
            }
            else {
                stateManager.setState({ state: States.RECOVERING });
                this._recover(state);
            }
        }
        else {
            stateManager.setState({ state: States.ACTIVE });
            this._startNodes(job.data);
        }
    }

    async _onJobStop(state) {
        this._stopWorkers(state.workers);
    }

    _recover(state) {
        const nodes = state.driverTasks.map(t => t.nodeName).filter((v, i, a) => a.indexOf(v) === i);
        nodes.forEach(n => {
            const node = this._nodes.getNode(n);
            const options = Object.assign({}, { flowInput: this._job.data.flowInput }, { input: node.input });
            const result = inputParser.parse(options, node.input);

            if (result.batch) {
                result.input.forEach((inp, ind) => {
                    const batch = new Batch({
                        name: node.name,
                        batchID: `${node.name}#${(ind + 1)}`,
                        algorithm: node.algorithm,
                        input: inp
                    });
                    this._nodes.addBatch(batch);
                })
            }
            else {
                this._nodes.setNode(node.name, { input: result.input });
            }
        });

        state.driverTasks.forEach(driverTask => {
            const jobTask = state.jobTasks.get(driverTask.taskId);
            if (jobTask && jobTask.status !== driverTask.status) {
                if (jobTask.status === States.COMPLETED) {
                    const node = new NodeState({
                        nodeName: driverTask.nodeName,
                        batchID: driverTask.batchID,
                        result: jobTask.result,
                        status: States.COMPLETED
                    });
                    log.info(`found completed job ${driverTask.taskId} after recover`, { component: components.JOBS_PRODUCER });
                    this._setTaskState(driverTask.taskId, node);
                    this._runCompleted(node.nodeName);
                }
                else if (jobTask.status === States.FAILED) {
                    const node = new NodeState({
                        nodeName: driverTask.nodeName,
                        batchID: driverTask.batchID,
                        error: jobTask.result,
                        status: States.FAILED
                    });
                    log.info(`found failed job ${driverTask.taskId} after recover`, { component: components.JOBS_PRODUCER });
                    this._setTaskState(driverTask.taskId, node);
                    this._jobDone(jobTask.result);
                }
                else {
                    this._watchWorker({
                        taskId: driverTask.taskId,
                        nodeName: driverTask.nodeName,
                        batchID: driverTask.batchID
                    });
                }
            }
        });
    }

    _setTaskState(taskId, data) {
        this._nodes.updateNodeState(data.nodeName, data.batchID, { state: data.status, error: data.error, result: data.result });
        stateManager.setTaskState({ taskId: taskId, value: data });
    }

    _startNodes(options) {
        const entryNodes = this._nodes.findEntryNodes();
        if (entryNodes.length === 0) {
            throw new Error('unable to find entry nodes');
        }
        entryNodes.forEach(n => this._runNode(n));
    }

    async _createJob(node) {
        const taskId = this._producer.createJobID(node.algorithm);
        const options = {
            job: {
                id: taskId,
                type: node.algorithm,
                data: {
                    input: node.input,
                    node: node.batchID || node.name,
                    jobID: this._job.id
                },
                internalData: {
                    nodeName: node.name,
                    batchID: node.batchID
                }
            }
        }
        await this._watchWorker({ taskId: taskId, nodeName: node.name, batchID: node.batchID });
        this._producer.createJob(options);
    }
}

module.exports = new JobProducer();
