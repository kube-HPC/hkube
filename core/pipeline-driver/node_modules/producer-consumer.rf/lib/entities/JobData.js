
class JobData {
    constructor(options) {
        this.jobID = options.id;
        this.prefix = options.prefix
        this.error = options.error;
        this.result = options.result;
        this.options = options.options;
    }
}

module.exports = JobData;