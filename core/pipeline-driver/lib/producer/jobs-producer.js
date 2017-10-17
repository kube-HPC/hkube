const EventEmitter = require('events');
const validate = require('djsv');
const { Producer } = require('producer-consumer.rf');
const schema = require('lib/producer/schema');
const NodesMap = require('lib/nodes/nodes-map');
const consumer = require('lib/consumer/jobs-consumer');
const stateManager = require('lib/state/state-manager');
const Graph = require('lib/graph/graph-handler');
const States = require('lib/state/States');
const NodeState = require('lib/state/NodeState');
const inputParser = require('lib/parsers/input-parser');
const Node = require('lib/nodes/Node');

class JobProducer extends EventEmitter {

    constructor() {
        super();
        this._driverKey = null;
        this._nodesMap = null;
        this._producer = null;
        this._graph = null;
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
            const childs = this._graph.childs(nodeName);
            childs.forEach(child => {
                const node = this._graph.node(child);
                const waitAnyIndex = inputParser.waitAnyInputIndex(node.input);
                if (waitAnyIndex > -1) {
                    this._runWaitAny(child, data.result);
                }
                else {
                    const allFinished = this._isAllParentsFinished(child);
                    if (allFinished) {
                        const results = this._nodesMap.nodeResults(nodeName);
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
        const node = this._graph.node(nodeName);
        const batchIndex = inputParser.batchInputIndex(node.input);
        const nodeIndex = inputParser.nodeInputIndex(node.input);
        const options = Object.assign({}, this._options, node);
        if (batchIndex > -1) {
            let input;
            if (nodeInput) {
                input = nodeInput;
            }
            else {
                input = inputParser.parseValue(options, node.input[batchIndex].substr(1));
            }
            this._runBatch(nodeName, input, batchIndex);
        }
        else if (nodeIndex > -1) {
            const input = node.input.slice();
            node.input.forEach((inp, ind) => {
                if (inputParser.isNode(inp)) {
                    const output = this._getNodeOutput(inp);
                    input[ind] = output;
                }
                else {
                    input[ind] = inputParser.parseValue(options, inp);
                }
            })
            const n = new Node({ name: node.nodeName, algorithm: node.algorithmName, input: input });
            this._nodesMap.addNode(n.name, n);
            this._createJob(n);
        }
        else {
            const n = new Node({ name: node.nodeName, algorithm: node.algorithmName, input: node.input });
            this._nodesMap.addNode(n.name, n);
            this._createJob(n);
        }
    }

    _runBatch(nodeName, nodeInput, inputIndex) {
        const node = this._graph.node(nodeName);
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
            const n = new Node({
                name: node.nodeName,
                batchID: `${node.nodeName}#${(ind + 1)}`,
                algorithm: node.algorithmName,
                input: input
            });
            this._nodesMap.addNode(n.batchID, n);
            this._createJob(n);
        })
    }

    _runWaitAny(nodeName, nodeInput) {
        const node = this._graph.node(nodeName);
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
        const n = new Node({ name: node.nodeName, algorithm: node.algorithmName, input: input });
        this._nodesMap.addNode(n.name, n);
        this._createJob(n);
    }

    _jobDone() {
        if (this._nodesMap.isAllNodesActive()) {
            const results = this._nodesMap.allNodesResults();
            this._currentJob.done(null, results);
        }
    }

    _getNodeOutput(node) {
        const nodeName = node.substr(1);
        const result = inputParser.extractObject(nodeName);
        const nodes = this._nodesMap.getNodes(result.object);
        const results = nodes.map(n => n.result);
        const output = results.map(r => inputParser.parseValue(r, result.path));
        return output;
    }

    async _onJobStart(job) {
        this._currentJob = job;
        this._driverKey = job.id;
        this._nodesMap = new NodesMap(job.data);
        this._graph = new Graph(job.data);
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
        const nodeID = internal.batchID || internal.node;
        this._nodesMap.updateNodeState(nodeID, { state: state, error: data.error, result: data.result });
        const nodeState = new NodeState({ jobID: data.jobID, state: state, internalData: internal, error: data.error, result: data.result });
        stateManager.setWorkerState({ driverKey: this._driverKey, workerKey: data.jobID, value: nodeState });
    }

    _startNodes(options) {
        const entryNodes = this._graph.findEntryNodes();
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
        const parents = this._graph.parents(node);
        const states = [];
        parents.forEach(p => {
            const nodes = this._nodesMap.getNodes(p);
            nodes.forEach(n => {
                states.push(this._nodesMap.getNodeState(n.batchID || n.name));
            })
        })
        return states.every(s => s === States.COMPLETED);
    }
}

module.exports = new JobProducer();
