
const orderBy = require('lodash.orderby');
const groupBy = require('lodash.groupby');
const Metric = require('./Metric');

class PrometheusMetric extends Metric {

    constructor(options) {
        super(options);
    }

    calc(options) {
        const prometheus = Object.entries(options.prometheus).map(([k, v]) => ({ type: k, ...v }));
        const sum = prometheus.map(v => v.runTime).reduce((a, b) => a + b, 0);
        let ratios = prometheus.map(v => ({ ...v, ratio: 1 - (v.runTime / sum) }));
        const newRatio = ratios.map(v => v.ratio).reduce((a, b) => a + b, 0);
        ratios = ratios.map(v => ({ ...v, ratio: (v.ratio / newRatio) }));
        ratios = orderBy(ratios, q => q.ratio);
        console.log(JSON.stringify(ratios, null, 2));

        const grouped = groupBy(options.algorithmQueue, 'alg');

        const map = Object.create(null);

        ratios.forEach(r => {
            const length = grouped[r.type].length * r.ratio;
            if (!map[r.type]) {
                map[r.type] = { pods: Math.round(length) };
            }
        });

        return map;

        return this.calcBase(options);
    }
}

module.exports = PrometheusMetric;