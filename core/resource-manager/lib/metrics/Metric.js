

class Metric {

    constructor(settings, options) {
        this.settings = settings;
        this.name = options.name;
        this.weight = options.weight;
    }

    calcBase() {

    }
}

module.exports = Metric;