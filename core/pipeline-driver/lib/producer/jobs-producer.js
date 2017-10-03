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
            const node = data.options.internalData.node;
            const childs = this._graph.childs(node);
            childs.forEach(child => {
                const res = this._isAllParentsFinished(child);
                if (res) {
                    this._runNode(child);
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

    _runNode(nodeName) {
        const node = this._graph.node(nodeName);
        const batchIndex = this._findBatchInputIndex(node.input);
        const nodeIndex = this._findNodeInputIndex(node.input);
        const options = Object.assign({}, this._options, node);
        if (batchIndex > -1) {
            const inputs = inputParser.parseValue(options, node.input[batchIndex].substr(1));
            if (!Array.isArray(inputs)) {
                throw new Error(`node ${node.nodeName} batch input must be an array`);
            }
            inputs.forEach((inp, ind) => {
                const input = node.input.slice();
                input[batchIndex] = inp;
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
        else if (nodeIndex > -1) {
            node.input.forEach((inp, ind) => {
                if (typeof inp === 'string' && inp.charAt(0) === '@') {
                    const ndName = inp.substr(1);
                    const result = inputParser.extractObject(ndName);
                    const nodes = this._nodesMap.getNodes(result.object);
                    const results = nodes.map(n => n.result);
                    const inputs = results.map(r => inputParser.parseValue(r, result.path));
                    const input = node.input.slice();
                    input[nodeIndex] = inputs;
                    const n = new Node({ name: node.nodeName, algorithm: node.algorithmName, input: input });
                    this._nodesMap.addNode(n.name, n);
                    this._createJob(n);
                }
            })
        }
        else {
            const n = new Node({ name: node.nodeName, algorithm: node.algorithmName, input: node.input });
            this._nodesMap.addNode(n.name, n);
            this._createJob(n);
        }
    }

    _findBatchInputIndex(input) {
        return input.findIndex(i => typeof i === 'string' && i.charAt(0) === '#')
    }

    _findNodeInputIndex(input) {
        return input.findIndex(i => typeof i === 'string' && i.charAt(0) === '@')
    }

    _jobDone() {
        if (this._nodesMap.isAllNodesActive()) {
            const results = this._nodesMap.allNodesResults();
            this._currentJob.done(null, results);
        }
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
