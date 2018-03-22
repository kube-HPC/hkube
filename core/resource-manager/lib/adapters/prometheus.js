
const Adapter = require('./Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;
const client = require('@hkube/prometheus-client');

class PrometheusAdapter extends Adapter {

    constructor(settings, options) {
        super(settings);
        client.init(options.prometheus);
    }

    async getData() {
        let currentDate = (new Date).getTime();
        let twentyMinutesBefore = new Date(currentDate - (20 * 60 * 1000));

        let res = await client.range({
            query: 'histogram_quantile(0.5, sum(rate(algorithm_net_histogram_bucket[2m])) by (algorithmName, le))/1000',
            start: twentyMinutesBefore / 1000,
            end: currentDate / 1000,
            step: 172
        });
        let arr = [];
        res.data.result.forEach(metric => {

        });
        // console.log(res)
    }
}

module.exports = PrometheusAdapter;