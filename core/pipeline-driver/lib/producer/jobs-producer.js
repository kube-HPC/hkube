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
        let setting = {};
        const res = validate(schema.properties.setting, setting);
        setting = Object.assign({}, setting, { redis: options.redis });
        if (!res.valid) {
            throw new Error(res.errors[0].stack);
        }

        this._producer = new Producer({ setting: setting });
        this._producer.on('job-waiting', (data) => {
            log.info(`job waiting ${data.jobID}`, { component: components.JOBS_PRODUCER });
            let task = Object.assign({}, { jobID: data.jobID }, data.options.internalData);
            this._setJobState(task, States.PENDING);
        }).on('job-active', (data) => {
            log.info(`job active ${data.jobID}`, { component: components.JOBS_PRODUCER });
            let task = Object.assign({}, { jobID: data.jobID }, data.options.internalData);
            this._setJobState(task, States.ACTIVE);
        }).on('job-completed', (data) => {
            log.info(`job completed ${data.jobID}`, { component: components.JOBS_PRODUCER });
        }).on('job-failed', (data) => {
            log.error(`job failed ${data.jobID}, error: ${data.error}`, { component: components.JOBS_PRODUCER });
            let task = Object.assign({}, { jobID: data.jobID, error: data.error }, data.options.internalData);
            this._setJobState(task, States.FAILED);
            this._jobDone(data.error);
        });

        consumer.on('job-stop', async (job) => {
            let state = await stateManager.getState({ jobID: job.id });
            this._onJobStop(state);
        });
        consumer.on('job-start', (job) => {
            this._onJobStart(job);
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
            log.info(`job completed ${this._job.id}`, { component: components.JOBS_PRODUCER });
            const results = this._nodes.allNodesResults();
            // stateManager.setJobsState(results);
            this._job.done(null, results);
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
        this._jobID = job.id;
        this._nodes = new NodesHandler(job.data);

        // first we will try to get the state for this job
        const state = await stateManager.getState({ jobID: job.id });
        if (state) {
            if (state.state === States.STOPPED) {
                this._onJobStop(state);
            }
            else {
                stateManager.setDriverState({ jobID: job.id, value: { state: States.RECOVERING } });
                // this._producer.setJobsState(state.jobs);
            }
        }
        else {
            stateManager.setDriverState({ jobID: job.id, value: { state: States.ACTIVE } });
            this._startNodes(job.data);
        }
    }

    async _onJobStop(state) {
        this._stopWorkers(state.workers);
    }

    _setJobState(data, state) {
        this._nodes.updateNodeState(data.nodeName, data.batchID, { state: state, error: data.error, result: data.result });
        const nodeState = new NodeState({ jobID: data.jobID, state: state, internalData: data, error: data.error, result: data.result });
        stateManager.setTaskState({ jobID: this._jobID, taskID: data.jobID, value: nodeState });
    }

    _startNodes(options) {
        const entryNodes = this._nodes.findEntryNodes();
        if (entryNodes.length === 0) {
            throw new Error('unable to find entry nodes');
        }
        entryNodes.forEach(n => this._runNode(n));
    }

    async _createJob(node) {
        const options = {
            job: {
                type: node.algorithm,
                data: {
                    input: node.input,
                    node: node.batchID || node.name,
                    jobID: this._jobID
                },
                internalData: {
                    nodeName: node.name,
                    batchID: node.batchID
                }
            }
        }

        const taskID = await this._producer.createJob(options);
        stateManager.setTaskState({
            jobID: this._jobID,
            taskID: taskID,
            value: {
                internalData: {
                    nodeName: node.name,
                    batchID: node.batchID
                }
            }
        })
        stateManager.watch(`/jobs/${this._jobID}/tasks/${taskID}/info/result`, async (res) => {
            const result = JSON.parse(res.node.value);
            let taskID = res.node.key;
            taskID = taskID.substr(taskID.indexOf('/tasks') + 6);
            taskID = taskID.substr(0, taskID.indexOf('/info'))
            const taskState = await stateManager.getTaskState({ jobID: this._jobID, taskID: taskID });
            const task = Object.assign({}, { result: result }, { jobID: this._jobID }, taskState.internalData);
            log.info(`job completed ${taskID}`, { component: components.JOBS_PRODUCER });
            this._setJobState(task, States.COMPLETED);
            this._runCompleted(task.nodeName);
        });
    }
}

module.exports = new JobProducer();
