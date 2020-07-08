class Metric {
    constructor(options) {
        this.name = options.name;
        this.mandatory = options.setting.mandatory;
        this.weight = options.setting.weight;
        this.config = options.config;
    }
}

module.exports = Metric;
