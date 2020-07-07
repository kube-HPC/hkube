class PipelineReprocess extends Error {
    constructor(status) {
        super(`pipeline already in ${status} status`);
        this.status = status;
    }
}

module.exports = PipelineReprocess;
