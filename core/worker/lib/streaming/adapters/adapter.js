const { uid } = require('@hkube/uid');

/**
 * The Adapter is a base class for master and slave adapters
 */
class Adapter {
    constructor(options) {
        this.isMaster = options.isMaster;
        this.jobId = options.jobId;
        this.source = `${options.source}-${options.jobId}-${uid()}`; // uid because multiple sources have the same node name
        this.nodeName = options.nodeName;
    }
}

module.exports = Adapter;
