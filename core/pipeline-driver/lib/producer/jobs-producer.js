const EventEmitter = require('events');
const validate = require('djsv');
const objectPath = require('object-path');
const schema = require('./schema');
const NodesMap = require('../graph/nodes-map');
const { Producer } = require('producer-consumer.rf');
const consumer = require('../consumer/jobs-consumer');
const stateManager = require('../state/state-manager');
const Graph = require('../graph/graph-handler');
const NodeState = require('../state/NodeState');
const Node = require('../graph/Node');
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

        consumer.on('job-start', async (job) => {
            this._currentJob = job;
            this._parseInput(job.data);
            this._driverKey = job.id;
            this._graph = new Graph(job.data)
            this._nodesMap = new NodesMap();

            console.log('isDirected: ' + this._graph.isDirected());
            console.log('isAcyclic: ' + this._graph.isAcyclic());
            console.log('Cycles: ' + this._graph.findCycles());

            // first we will try to get the state for this job
            let state = await stateManager.getWorkersState({ key: job.id });
            if (false) {
                stateManager.setDriverState({ key: job.id, value: { status: 'recovering' } });
                this._producer.setJobsState(state);
            }
            else {
                //stateManager.setDriverState({ key: job.id, value: { status: 'starting' } });

                await this._runNodes(job.data);
            }
            // Get data from Neo4j
            // console.log(job)
            // format the job data
            // console.log(result);

        });
    }

    _setWorkerState(data, status, result) {
        const node = data.options.internalData.node;
        const nodeState = new NodeState({ jobID: data.jobID, status: status, internalData: data.options.internalData });
        stateManager.setWorkerState({ driverKey: this._driverKey, workerKey: data.jobID, value: nodeState });
        this._nodesMap.updateState(node, status, result);
    }

    async _runNodes(options) {
        const entryNodes = this._graph.findEntryNodes();
        if (entryNodes.length === 0) {
            throw new Error('unable to find entry nodes');
        }
        entryNodes.forEach(n => this._runNode(n));
    }

    _runNode(nodeName, prevInput) {
        const current = this._graph.node(nodeName);
        if (current.batchInput.length > 0) {
            current.batchInput.forEach((batch, i) => {
                const node = new Node({ name: current.nodeName, batchID: `${current.nodeName}#${i}`, algorithm: current.algorithmName, input: batch });
                this._createJob(node, prevInput);
            })
        }
        else {
            const node = new Node({ name: current.nodeName, algorithm: current.algorithmName, input: current.input });
            this._createJob(node, prevInput);
        }
    }

    _createJob(node, prevInput) {
        const options = {
            job: {
                type: node.algorithm,
                data: {
                    input: node.input,
                    prevInput: prevInput
                },
                internalData: {
                    node: node.name,
                    batchID: node.batchID
                }
            }
        }
        this._nodesMap.addNode(node);
        this._producer.createJob(options);
    }

    _isAllParentsFinished(node) {
        const parents = this._graph.parents(node);
        return parents.map(p => this._nodesMap.getState(p)).every(s => s === 'completed');
    }

    _parseValue(data, input) {
        if (typeof input == null) {
            return null;
        }
        else if (typeof input === 'string') {
            input = objectPath.get(data, input);
        }
        else if (typeof input === 'object' && !Array.isArray(input)) {
            this._recursivelyObject(data, input);
        }
        else if (Array.isArray(input)) {
            this._recursivelyArray(data, input);
        }
        return input;
    }

    _recursivelyArray(data, array) {
        array.forEach((a, i) => {
            if (Array.isArray(a)) {
                this._recursivelyArray(data, a);
            }
            else if (typeof a === 'object' && !Array.isArray(a)) {
                this._recursivelyObject(data, a);
            }
            else if (typeof array[a] !== 'object') {
                array[i] = objectPath.get(data, a);
            }
        })
    }

    _recursivelyObject(data, object) {
        Object.entries(object).forEach(([key, val]) => {
            if (Array.isArray(val)) {
                this._recursivelyArray(data, val);
            }
            else if (typeof val === 'object' && !Array.isArray(val)) {
                this._recursivelyObject(data, val);
            }
            else if (typeof object[key] !== 'object') {
                object[key] = objectPath.get(data, val);
            }
        })
    }

    _parseInput(options) {
        options.nodes.forEach(node => {
            node.input = this._parseValue(options, node.input);
            node.batchInput = this._parseValue(options, node.batchInput);
        });
    }
}

module.exports = new JobProducer();
