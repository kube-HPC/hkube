
const MAX_SCORE = 1;

class MetricsRunner {
    constructor(options) {
        this._metrics = [];
        this._init(options);
    }

    _init(options) {
        if (!options.metrics) {
            throw new ReferenceError('metrics');
        }
        let score = 0;
        options.metrics.forEach(m => {
            score += m.weight;
            let Metric = require(__dirname + '/' + m.name);
            this._metrics.push(new Metric(options, m));
        });

        score = parseFloat(score.toFixed(2));
        if (score !== MAX_SCORE) {
            throw new Error(`metrics total score must be equal to ${MAX_SCORE}, current ${score}`);
        }
    }

    run(options) {
        return this._metrics.map(m => ({ name: m.name, weight: m.weight, data: m.calc(options) }));
    }
}

module.exports = MetricsRunner;