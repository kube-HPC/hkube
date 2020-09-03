const Logger = require('@hkube/logger');
const { NodesMap } = require('@hkube/dag');
const stateAdapter = require('../../states/stateAdapter');
const { Interval } = require('../core');
const { Components } = require('../../consts');
const component = Components.ELECTION;
let log;

/**
 * This class is responsible for the election process.
 * The worker represents a node in a pipeline, node can have also children relation.
 * For instance, nodes A,B,C stream data to node D.
 * Nodes A,B,C need to scale-up/down node D, but in order to prevent collisions,
 * this module perform an election using locks on specific node (<jobId>/<node>), if the lock
 * was successful, we define a master on this node, else a slave.
 * Master can scale-up/down, and Slave only reports its statistics so the master will handle it.
 * This module tries periodically to do this process, so if another worker loses its lock, this
 * current worker will become a master.
 */

class Election {
    constructor(options, addAdapter) {
        this._options = options;
        this._addAdapter = addAdapter;
        log = Logger.GetLogFromContainer();
    }

    async start(jobData) {
        this._jobData = jobData;
        this._pipeline = await stateAdapter.getExecution({ jobId: jobData.jobId });
        this._dag = new NodesMap(this._pipeline);
        this._nodes = this._pipeline.nodes.reduce((acc, cur) => {
            acc[cur.nodeName] = cur;
            return acc;
        }, {});

        await this._election();

        this._electInterval = new Interval({ delay: this._options.election.interval })
            .onFunc(() => this._election())
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    stop() {
        this._electInterval.stop();
    }

    async _election() {
        const { childs, jobId, nodeName } = this._jobData;
        const data = { config: this._options.autoScaler, pipeline: this._pipeline, jobData: this._jobData, jobId };
        await Promise.all(childs.map(c => this._elect({ ...data, nodeName: c, source: nodeName, node: this._createNode(c) })));
    }

    async _elect(options) {
        const lock = await stateAdapter.acquireStreamingLock(options);
        this._addAdapter({ isMaster: lock.success, ...options });
    }

    _createNode(nodeName) {
        const node = this._nodes[nodeName];
        const parents = this._dag._parents(nodeName);
        const childs = this._dag._childs(nodeName);
        return { ...node, parents, childs };
    }
}

module.exports = Election;
