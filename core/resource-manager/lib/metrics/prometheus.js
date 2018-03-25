
const orderBy = require('lodash.orderby');
const groupBy = require('lodash.groupby');
const Metric = require('./Metric');
const utils = require('../utils/utils');
const ResourceDecider = require('../resource-handlers/resource-decider');

class PrometheusMetric extends Metric {

    constructor(settings, options) {
        super(settings, options);
    }

    calc(options) {
        const sum = options.prometheus.map(v => v.runTime).reduce((a, b) => a + b, 0);
        let ratios = options.prometheus.map(v => ({ ...v, ratio: 1 - (v.runTime / sum) }));
        const newRatio = ratios.map(v => v.ratio).reduce((a, b) => a + b, 0);
        ratios = ratios.map(v => ({ ...v, ratio: (v.ratio / newRatio) }));
        ratios = orderBy(ratios, q => q.ratio);
        const grouped = groupBy(options.algorithmQueue, 'alg');

        console.log(JSON.stringify(ratios, null, 2));

        const resourceDecider = new ResourceDecider(this.settings, options);

        let ratio = 0;
        ratios.forEach((r, i) => {
            ratio += r.ratio;
            r.range = { from: i > 0 ? ratios[i - 1].range.to + 0.00001 : 0, to: ratio }
            r.size = grouped[r.type].length;
        });

        while (true) {
            const random = Math.random();
            const ratio = ratios.find(r => random >= r.range.from && random <= r.range.to);
            resourceDecider.allocate(ratio.type);
            ratios[ratio.type]--;

        }

        return utils.mapToArray(map, ['alg', 'data']);
    }
}

module.exports = PrometheusMetric;