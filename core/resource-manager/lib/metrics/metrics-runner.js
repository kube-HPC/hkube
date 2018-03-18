

class MetricsRunner {
    constructor(options) {
        this.metrics = [];
    }

    init(options) {
        if (!options.metrics) {
            throw new ReferenceError('metrics');
        }
        let score = 0;
        options.metrics.forEach(m => {
            score += m.weight;
            let Metric = require(__dirname + '/' + m.name);
            this.metrics.push(new Metric(m));
        });

        score = parseFloat(score.toFixed(2));
        if (score !== 1) {
            throw new Error(`metrics total score must be equal to 1, current ${score}`);
        }
    }

    run(data) {
        const score = this.metrics.reduce((result, metric) => {
            const res = metric.calc(data);
            return res;
        }, 0);
    }
}

module.exports = new MetricsRunner();