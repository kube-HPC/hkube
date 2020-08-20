class Adapter {
    constructor(options) {
        this.isMaster = options.isMaster;
        this.jobId = options.jobId;
        this.source = options.source;
        this.nodeName = options.nodeName;
    }
}

module.exports = Adapter;
