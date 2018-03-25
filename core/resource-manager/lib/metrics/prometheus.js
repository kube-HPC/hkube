
const orderBy = require('lodash.orderby');
const groupBy = require('lodash.groupby');
const Metric = require('./Metric');
const utils = require('../utils/utils');

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
        const grouped = groupBy(options.algorithmQueue, 'alg');

        console.log(JSON.stringify(ratios, null, 2));

        let ratio = 0;
        ratios.forEach((r, i) => {
            ratio += r.ratio;
            r.range = { from: i > 0 ? ratios[i - 1].range.to + 0.00001 : 0, to: ratio }
            r.size = grouped[r.type].length;
        });

        while (true) {
            const random = Math.random();
            const ratio = ratios.find(r => random >= r.range.from && random <= r.range.to);

            ratios[ratio.type]--;


        }

        return utils.mapToArray(map, ['alg', 'data']);
    }
}

module.exports = PrometheusMetric;