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

class JobProducer extends EventEmitter {

    constructor() {
        super();
        this._driverKey = null;
        this._nodesMap = null;
        this._producer = null;
        this._graph = null;
    }

    init(options) {
        const setting = options || {};
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
            if (this._nodesMap.currentState === States.FAILED) {
                return;
            }

            this._setWorkerState(data, States.COMPLETED);
            const node = data.options.internalData.node;
            const childs = this._graph.childs(node);
            childs.forEach(child => {
                const res = this._isAllParentsFinished(child);
                if (res) {
                    this._runNode(child, data.result);
                }
            });

            if (this._nodesMap.isAllNodesInState(States.COMPLETED)) {
                const results = this._nodesMap.allNodesResults();
                this._currentJob.done(null, results);
            }

        }).on('job-failed', (data) => {
            if (this._nodesMap.currentState === States.FAILED) {
                return;
            }
            this._setWorkerState(data, States.FAILED);
            this._nodesMap.currentState = States.FAILED;
            this._currentJob.done(new Error('job has failed'));
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

    async _onJobStart(job) {
        this._currentJob = job;
        this._parseInput(job.data);
        this._driverKey = job.id;
        this._graph = new Graph(job.data)
        this._nodesMap = new NodesMap(job.data);

        // first we will try to get the state for this job
        const state = await stateManager.getState({ key: job.id });
        if (false) {
            if (state.status === States.STOPPED) {
                this._onJobStop(state);
            }
            else {
                stateManager.setDriverState({ key: job.id, value: { status: States.RECOVERING } });
                this._producer.setJobsState(state.workers);
            }
        }
        else {
            stateManager.setDriverState({ key: job.id, value: { status: States.ACTIVE } });
            this._runNodes(job.data);
        }
    }

    async _onJobStop(state) {
        this._stopWorkers(state.workers);
    }

    _stopWorkers(workers) {
        workers.forEach(w => {
            const nodeState = new NodeState({ jobID: w.jobID, status: States.STOPPED });
            stateManager.setWorkerState({ driverKey: this._driverKey, workerKey: w.jobID, value: nodeState });
        })
    }

    _setWorkerState(data, status) {
        const internal = data.options.internalData;
        const nodeID = internal.batchID || internal.node;
        this._nodesMap.updateNodeState(nodeID, { status: status, error: data.error, result: data.result });
        const nodeState = new NodeState({ jobID: data.jobID, status: status, internalData: internal, error: data.error, result: data.result });
        stateManager.setWorkerState({ driverKey: this._driverKey, workerKey: data.jobID, value: nodeState });
    }

    _runNodes(options) {
        const entryNodes = this._graph.findEntryNodes();
        if (entryNodes.length === 0) {
            throw new Error('unable to find entry nodes');
        }
        entryNodes.forEach(n => this._runNode(n));
    }

    _runNode(nodeName, prevInput) {
        const current = this._graph.node(nodeName);
        if (Array.isArray(current.batchInput) && current.batchInput.length > 0) {
            current.batchInput.forEach((b, i) => {
                const node = this._nodesMap.getNode(`${current.nodeName}#${i}`);
                this._createJob(node, prevInput);
            })
        }
        else {
            const node = this._nodesMap.getNode(current.nodeName);
            this._createJob(node, prevInput);
        }
    }

    _createJob(node, prevInput) {
        const options = {
            job: {
                type: node.algorithm,
                data: {
                    inputs: {
                        standard: node.inputs.standard,
                        batch: node.inputs.batch,
                        previous: prevInput
                    }
                },
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
        return parents.map(p => this._nodesMap.getNodeState(p)).every(s => s === States.COMPLETED);
    }

    _parseInput(options) {
        options.nodes.forEach(node => {
            node.input = inputParser.parseValue(options, node.input);
            node.batchInput = inputParser.parseValue(options, node.batchInput);
        });
    }
}

module.exports = new JobProducer();
