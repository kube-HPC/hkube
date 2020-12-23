class Trigger {
    constructor(options) {
        this.name = options.name;
        this.cron = options.triggers?.cron;
    }
}

module.exports = Trigger;
