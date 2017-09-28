const EventEmitter = require('events');
const validate = require('djsv');
const schema = require('./schema');
const NodesMap = require('../graph/nodes-map');
const { Producer } = require('producer-consumer.rf');
const consumer = require('../consumer/jobs-consumer');
const stateManager = require('../state/state-manager');
const Graph = require('../graph/graph-handler');
const NodeState = require('../state/NodeState');
const inputParser = require('../parsers/input-parser');
const debug = require('debug')('driver:producer');

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
            this._setWorkerState(data, 'waiting');
        }).on('job-active', (data) => {
            this._setWorkerState(data, 'active');
        }).on('job-completed', (data) => {
            this._setWorkerState(data, 'completed', data.result);
            const { node, batchID } = data.options.internalData;
            const childs = this._graph.childs(node);
            childs.forEach(child => {
                const res = this._isAllParentsFinished(child);
                if (res) {
                    this._runNode(child, data.result);
                }
            });

            if (this._nodesMap.isAllNodesFinished()) {
                const results = this._nodesMap.allNodesResults();
                this._currentJob.done(results);
            }

        }).on('job-failed', (data) => {
            this._setWorkerState(data, 'failed');
        });

        consumer.on('job-stop', async (job) => {
            let state = await stateManager.getDriverState({ key: job.id });

            for (let worker of state.workers) {
                stateManager.setWorkerState({ key: worker.jobID, value: { status: 'stopped' } });
            }
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
        let state = await stateManager.getWorkersState({ key: job.id });
        if (false) {
            stateManager.setDriverState({ key: job.id, value: { status: 'recovering' } });
            this._producer.setJobsState(state);
        }
        else {
            //stateManager.setDriverState({ key: job.id, value: { status: 'starting' } });

            this._runNodes(job.data);
        }
    }

    _setWorkerState(data, status, result) {
        const internal = data.options.internalData;
        const nodeID = internal.batchID || internal.node;
        const nodeState = new NodeState({ jobID: data.jobID, status: status, internalData: data.options.internalData });
        stateManager.setWorkerState({ driverKey: this._driverKey, workerKey: data.jobID, value: nodeState });
        this._nodesMap.updateState(nodeID, status, result);
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
        if (current.batchInput.length > 0) {
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
        return parents.map(p => this._nodesMap.getState(p)).every(s => s === 'completed');
    }

    _parseInput(options) {
        options.nodes.forEach(node => {
            node.input = inputParser.parseValue(options, node.input);
            node.batchInput = inputParser.parseValue(options, node.batchInput);
        });
    }
}

module.exports = new JobProducer();
