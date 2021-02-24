const Logger = require('@hkube/logger');
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
    constructor(options, addAdapter, getMasters) {
        this._options = options;
        this._addAdapter = addAdapter;
        this._getMasters = getMasters;
        log = Logger.GetLogFromContainer();
    }

    async start(nodes) {
        await this._election(nodes);

        this._electInterval = new Interval({ delay: this._options.election.interval })
            .onFunc(() => this._election(nodes))
            .onError((e) => log.throttle.error(e.message, { component }))
            .start();
    }

    async stop() {
        this._electInterval?.stop();
        await this._unElectNodes();
        this._addAdapter = null;
        this._getMasters = null;
    }

    async _election(nodes) {
        await Promise.all(nodes.map(n => this._electNode(n)));
    }

    async _electNode(options) {
        const lock = await stateAdapter.acquireStreamingLock(options);
        if (this._addAdapter) {
            this._addAdapter({ isMaster: lock.success, ...options });
        }
    }

    async _unElectNodes() {
        const masters = this._getMasters();
        await Promise.all(masters.map(m => stateAdapter.releaseStreamingLock({ jobId: m.jobId, nodeName: m.nodeName })));
    }
}

module.exports = Election;
