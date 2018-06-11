
const Adapter = require('../Adapter');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../../common/consts/componentNames').AlgorithmDb;
const client = require('@hkube/prometheus-client');
const median = require('median');
const Cache = require('../../cache/cache-provider');

class PrometheusAdapter extends Adapter {
    constructor(options, name) {
        super(options, name);
        if (!options.prometheus || !options.prometheus.endpoint) {
            log.warning('PrometheusAdapter not initialized. Connection is empty', { component });
            this._isInit = false;
            return;
        }
        client.init(options.prometheus);
        this._isInit = true;
        this._cache = new Cache({ key: this.name, maxAge: 1000 * 60 * 5 });
    }

    async getData() {
        if (!this._isInit) {
            return [];
        }
        const data = this._cache.get();
        if (data) {
            return data;
        }
        const resources = await this._getResources();
        const arr = [];
        const algoRunTime = new Map();
        resources.algoRuntime.data.result.forEach(algorithm => {
            algorithm.values.forEach(slice => {
                if (algoRunTime.has(algorithm.metric.algorithmName)) {
                    const a = algoRunTime.get(algorithm.metric.algorithmName);
                    a.push(parseFloat(slice[1]));
                }
                else {
                    algoRunTime.set(algorithm.metric.algorithmName, [parseFloat(slice[1])]);
                }
            });
        });
        algoRunTime.forEach((val, key) => arr.push({ algorithmName: key, runTime: median(val) }));
        this._cache.set(arr);
        return arr;
    }

    async _getResources() {
        const currentDate = Date.now();
        const sixHoursBefore = new Date(currentDate - (6 * 60 * 60 * 1000));
        const [cpuCurrent, memCurrent, algoRuntime] = await Promise.all([
            client.query({ query: '100 * (1 - avg by(instance)(irate(node_cpu{mode="idle"}[2m])))' }),
            client.query({ query: '(1 - ((node_memory_MemFree + node_memory_Buffers + node_memory_Cached) / node_memory_MemTotal)) * 100' }),
            client.range({
                query: 'algorithm_runtime_summary{quantile="0.5", algorithmName!~""}',
                start: sixHoursBefore / 1000,
                end: currentDate / 1000,
                step: 60
            })
        ]);
        return { cpuCurrent, memCurrent, algoRuntime };
    }
}

module.exports = PrometheusAdapter;
