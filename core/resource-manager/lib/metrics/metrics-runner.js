

class MetricsRunner {
    constructor(options) {
        this._idx = 0;
        this._results = null;
        this._metrics = [];
    }

    init(options) {
        if (!options.metrics) {
            throw new ReferenceError('metrics');
        }
        let score = 0;
        options.metrics.forEach(m => {
            score += m.weight;
            let Metric = require(__dirname + '/' + m.name);
            this._metrics.push(new Metric(m));
        });

        score = parseFloat(score.toFixed(2));
        if (score !== 1) {
            throw new Error(`metrics total score must be equal to 1, current ${score}`);
        }
    }

    run(data) {
        this._results = this._results || data;
        const nextLayer = this._metrics[this._idx++];
        if (!nextLayer) {
            const tmpResults = this._results;
            this._idx = 0;
            this._results = null;
            return tmpResults;
        }
        this._results = nextLayer.calc(this._results);
        return this.run();
    }

}

module.exports = new MetricsRunner();