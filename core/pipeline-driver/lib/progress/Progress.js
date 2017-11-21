class Progress {

    constructor(options) {
        this.level = options.level;
        this.status = options.status;
        this.error = options.error;
        this.details = options.details;
    }
}

module.exports = Progress;