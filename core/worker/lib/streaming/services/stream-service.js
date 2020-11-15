const EventEmitter = require('events');
const { NodesMap: DAG } = require('@hkube/dag');
const { consts } = require('@hkube/parsers');
const stateAdapter = require('../../states/stateAdapter');
const Election = require('./election');
const AdaptersProxy = require('../adapters/adapters-proxy');
const ThroughputCollector = require('./throughput-collector');
const ScalerService = require('./scaler-service');
const { streamingEvents } = require('../../consts');

/**
 * This class is responsible start and stop the following services:
 * 1. Auto-scaler
 * 2. Adapters-proxy
 * 3. Election-service
 * 4. Throughput-collector
 */

class StreamService extends EventEmitter {
    init(options) {
        this._options = options.streaming;
    }

    async start(jobData) {
        this._jobData = jobData;
        const nodes = await this._createNodesForElection(jobData);
        this._adapters = new AdaptersProxy();
        this._election = new Election(this._options, (a) => this._adapters.addAdapter(a), () => this._adapters.getMasters(),);
        await this._election.start(nodes);
        this._throughput = new ThroughputCollector(this._options, () => this._adapters.throughput());
        this._throughput.on(streamingEvents.THROUGHPUT_CHANGED, (changes) => {
            this.emit(streamingEvents.THROUGHPUT_CHANGED, changes);
        });
        this._scalerService = new ScalerService(this._options, () => this._adapters.scale());
        this._active = true;
    }

    async _createNodesForElection(jobData) {
        const { childs, jobId, nodeName } = jobData;
        const pipeline = await stateAdapter.getExecution({ jobId });
        const dag = new DAG(pipeline);
        const nodesMap = pipeline.nodes.reduce((acc, cur) => {
            acc[cur.nodeName] = cur;
            return acc;
        }, {});
        const data = { config: this._options.autoScaler, pipeline, jobData, jobId };
        const nodes = childs.map((c) => {
            const nodeMap = nodesMap[c];
            const streamChilds = this._streamChilds(dag, c.nodeName);
            const node = {
                ...data,
                nodeName: c.nodeName,
                source: nodeName,
                node: { ...nodeMap, parents: dag._parents(c.nodeName), childs: streamChilds }
            };
            return node;
        });
        return nodes;
    }

    _streamChilds(dag, nodeName) {
        const child = dag._childs(nodeName);
        const streamChilds = child.map(c => ({ nodeName: c, isMainFlow: dag.getEdgeTypes(nodeName, c).includes(consts.relations.INPUT) }));
        return streamChilds;
    }

    async finish() {
        if (!this._active) {
            return;
        }
        this._active = false;
        this._jobData = null;
        this._scalerService?.stop();
        this._throughput?.stop();
        await this._election?.stop();
        await this._adapters?.stop();
        this._scalerService = null;
        this._throughput = null;
        this._election = null;
        this._adapters = null;
    }

    reportStats(data) {
        if (!this._active) {
            return;
        }
        data.forEach((d) => {
            this._adapters.report(d);
        });
    }
}

module.exports = new StreamService();
