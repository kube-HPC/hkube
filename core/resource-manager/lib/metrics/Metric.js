
class Metric {
    constructor(settings, options) {
        this.settings = settings;
        this.name = options.name;
        this.weight = options.weight;
    }
}

module.exports = Metric;