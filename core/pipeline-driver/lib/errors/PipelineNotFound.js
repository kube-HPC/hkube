class PipelineNotFound extends Error {
    constructor(jobId) {
        super(`unable to find pipeline for job ${jobId}`);
        this.jobId = jobId;
    }
}

module.exports = PipelineNotFound;
