class Trigger {
    constructor(options) {
        this.name = options.name;
        this.cron = options.triggers && options.triggers.cron;
        this.pipelines = options.triggers && options.triggers.pipelines;
    }
}

module.exports = Trigger;
