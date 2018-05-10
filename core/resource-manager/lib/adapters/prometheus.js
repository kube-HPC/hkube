
const Adapter = require('./Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').AlgorithmDb;
const client = require('@hkube/prometheus-client');
var median = require('median')

class PrometheusAdapter extends Adapter {

    constructor(options) {
        super(options);
        if (!options.connection || !options.connection.endpoint) {
            log.warning('PrometheusAdapter not initialized. Connection is empty', { component });
            this._isInit = false;
            return;
        }
        client.init(options.connection);
        this._isInit = true;
    }

    async getData() {
        if (!this._isInit) {
            return [];
        }
        let data = this.cache.get();
        if (data) {
            return data;
        }

        let resources = await this._getResources();
        let arr = [];
        let algoRunTime = new Map();
        resources.algoRuntime.data.result.forEach(algorithm => {
            algorithm.values.forEach(slice => {
                if (algoRunTime.has(algorithm.metric.algorithmName)) {
                    let a = algoRunTime.get(algorithm.metric.algorithmName);
                    a.push(parseFloat(slice[1]));
                }
                else {
                    algoRunTime.set(algorithm.metric.algorithmName, [parseFloat(slice[1])]);
                }
            })
        });
        algoRunTime.forEach((val, key) => arr.push({ algorithmName: key, runTime: median(val) }));
        this.cache.set(arr);
        return arr;

    }

    async _getResources() {
        let currentDate = Date.now();
        let sixHoursBefore = new Date(currentDate - (6 * 60 * 60 * 1000));
        let [cpuCurrent, memCurrent, algoRuntime] = await Promise.all([
            client.query({ query: '100 * (1 - avg by(instance)(irate(node_cpu{mode="idle"}[2m])))' }),
            client.query({ query: '(1 - ((node_memory_MemFree + node_memory_Buffers + node_memory_Cached) / node_memory_MemTotal)) * 100' }),
            client.range({
                query: 'algorithm_runtime_summary{quantile="0.5", algorithmName!~""}',
                start: sixHoursBefore / 1000,
                end: currentDate / 1000,
                step: 60
            })
        ]);
        return { cpuCurrent, memCurrent, algoRuntime }
    }
}

module.exports = PrometheusAdapter;