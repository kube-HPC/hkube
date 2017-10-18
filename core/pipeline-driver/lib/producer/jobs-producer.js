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

class JobProducer extends EventEmitter {

    constructor() {
        super();
        this._driverKey = null;
        this._producer = null;
        this._nodes = null;
    }

    init(options) {
        const setting = {};
        const res = validate(schema.properties.setting, setting);
        if (!res.valid) {
            throw new Error(res.errors[0].stack);
        }

        this._producer = new Producer({ setting: setting });
        this._producer.on('job-waiting', (data) => {
            this._setWorkerState(data, States.PENDING);
        }).on('job-active', (data) => {
            this._setWorkerState(data, States.ACTIVE);
        }).on('job-completed', (data) => {
            this._setWorkerState(data, States.COMPLETED);
            const nodeName = data.options.internalData.node;
            const childs = this._nodes.childs(nodeName);
            childs.forEach(child => {
                const node = this._nodes.getNode(child);
                const waitAnyIndex = inputParser.waitAnyInputIndex(node.input);
                if (waitAnyIndex > -1) {
                    this._runWaitAny(child, data.result);
                }
                else {
                    const allFinished = this._isAllParentsFinished(child);
                    if (allFinished) {
                        const results = this._nodes.nodeResults(nodeName);
                        this._runNode(child, results);
                    }
                }
            });
            this._jobDone();
        }).on('job-failed', (data) => {
            this._setWorkerState(data, States.FAILED);
            this._jobDone();
        });

        consumer.on('job-stop', async (job) => {
            let state = await stateManager.getState({ key: job.id });
            this._onJobStop(state);
        });
        consumer.on('job-start', (job) => {
            this._onJobStart(job);
            // console.log('isDirected: ' + this._graph.isDirected());
            // console.log('isAcyclic: ' + this._graph.isAcyclic());
            // console.log('Cycles: ' + this._graph.findCycles());

            // Get data from Neo4j
            // console.log(job)
            // format the job data
            // console.log(result);
        });
    }

    _runNode(nodeName, nodeInput) {
        const node = this._nodes.getNode(nodeName);
        const batchIndex = inputParser.batchInputIndex(node.input);
        const nodeIndex = inputParser.nodeInputIndex(node.input);
        const options = Object.assign({}, this._options, node);
        if (batchIndex > -1) {
            let input;
            if (nodeInput) {
                input = nodeInput;
            }
            else {
                //const obj = inputParser.extractObjectFromInput(node.input[batchIndex]);
                input = inputParser.parseValue(options, node.input[batchIndex]);
            }
            this._runBatch(nodeName, input, batchIndex);
        }
        else {
            const input = node.input.slice();
            input.forEach((inp, ind) => {
                if (nodeInput) {
                    nodeInput.forEach((ni) => {
                        inputParser.parseNodeInput(ni, inp);
                    })
                }
            })
            this._nodes.setNode(node.name, { input: input });
            this._createJob(node);
        }
    }

    _runBatch(nodeName, nodeInput, inputIndex) {
        const node = this._nodes.getNode(nodeName);
        if (!Array.isArray(nodeInput)) {
            throw new Error(`node ${nodeName} batch input must be an array`);
        }
        const options = Object.assign({}, this._options, node);
        nodeInput.forEach((inp, ind) => {
            const input = node.input.slice();
            input.forEach((inp, ind) => {
                if (inputParser.isNode(inp)) {
                    const output = this._getNodeOutput(inp);
                    input[ind] = output;
                }
                else {
                    input[ind] = inputParser.parseValue(options, inp);
                }
            });
            input[inputIndex] = inp;
            const batch = new Batch({
                name: node.name,
                batchID: `${node.name}#${(ind + 1)}`,
                algorithm: node.algorithm,
                input: input
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

    _jobDone() {
        if (this._nodes.isAllNodesDone()) {
            const results = this._nodes.allNodesResults();
            this._currentJob.done(null, results);
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
        this._currentJob = job;
        this._driverKey = job.id;
        this._nodes = new NodesHandler(job.data);
        this._options = job.data;

        // first we will try to get the state for this job
        const data = await stateManager.getState({ key: job.id });
        if (false) {
            if (data.state === States.STOPPED) {
                this._onJobStop(data);
            }
            else {
                stateManager.setDriverState({ key: job.id, value: { state: States.RECOVERING } });
                this._producer.setJobsState(state.jobs);
            }
        }
        else {
            stateManager.setDriverState({ key: job.id, value: { state: States.ACTIVE } });
            this._startNodes(job.data);
        }
    }

    async _onJobStop(state) {
        this._stopWorkers(state.workers);
    }

    _stopWorkers(workers) {
        workers.forEach(w => {
            const nodeState = new NodeState({ jobID: w.jobID, state: States.STOPPED });
            stateManager.setWorkerState({ key: w.jobID, value: nodeState });
        })
    }

    _setWorkerState(data, state) {
        const internal = data.options.internalData;
        this._nodes.updateNodeState(internal.node, internal.batchID, { state: state, error: data.error, result: data.result });
        const nodeState = new NodeState({ jobID: data.jobID, state: state, internalData: internal, error: data.error, result: data.result });
        stateManager.setWorkerState({ driverKey: this._driverKey, workerKey: data.jobID, value: nodeState });
    }

    _startNodes(options) {
        const entryNodes = this._nodes.findEntryNodes();
        if (entryNodes.length === 0) {
            throw new Error('unable to find entry nodes');
        }
        entryNodes.forEach(n => this._runNode(n));
    }

    _createJob(node) {
        const options = {
            job: {
                type: node.algorithm,
                data: { input: node.input, node: node.batchID || node.name },
                internalData: {
                    node: node.name,
                    batchID: node.batchID
                }
            }
        }
        this._producer.createJob(options);
    }

    _isAllParentsFinished(node) {
        const parents = this._nodes.parents(node);
        let states = [];
        parents.forEach(p => {
            states = states.concat(this._nodes.getNodeStates(p));
        })
        return states.every(s => s === States.COMPLETED);
    }
}

module.exports = new JobProducer();
