

class MetricsRunner {
    constructor(options) {
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

    run(options) {
        return this._metrics.map(m => ({ name: m.name, weight: m.weight, data: m.calc(options) }));
    }

    calc(options) {
        const map = {};
        options.reduce((prev, cur) => {
            cur.data.forEach(c => {
                if (c.alg in prev) {
                    prev[c.alg].pods += c.data.pods * cur.weight
                }
                else {
                    prev[c.alg] = { pods: c.data.pods * cur.weight };
                }
            })
            return prev;
        }, map);

        const results = [];
        Object.entries(map).forEach(([k, v]) => {
            results.push({ alg: k, data: v });
        });
        return results;
    }
}

module.exports = new MetricsRunner();