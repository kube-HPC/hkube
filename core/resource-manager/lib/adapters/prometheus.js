
const Adapter = require('./Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;
const client = require('@hkube/prometheus-client');
var median = require('median')

class PrometheusAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
        client.init(options.prometheus);
    }

    async getData() {
        let currentDate = (new Date).getTime();
        let twentyMinutesBefore = new Date(currentDate - (6 * 60 * 60 * 1000));

        let res = await client.range({
            query: 'histogram_quantile(0.5, sum(rate(algorithm_net_histogram_bucket[2m])) by (algorithmName, le)) / 1000',
            start: twentyMinutesBefore / 1000,
            end: currentDate / 1000,
            step: 60
        });
        let arr = [];
        res.data.result.forEach(algorithm => {
            let algoRunTime = [];
            algorithm.values.forEach(slice => {
                if (slice[1] != 0) {
                    algoRunTime.push(slice[1]);
                }
            })
            arr.push({ algorithmName: algorithm.metric.algorithmName, runTime: median(algoRunTime) })
        });
        return arr;
    }
}

module.exports = PrometheusAdapter;