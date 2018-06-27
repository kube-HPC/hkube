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
        const result = [];
        const algorithms = new Map();
        const podToAlgorithm = new Map();
        resources.algorithms.data.result.forEach(r => {
            podToAlgorithm.set(r.metric.pod, r.metric.label_algorithm_name);
        });
        resources.cpuUsage.data.result.forEach(r => {
            r.values.forEach(slice => {
                const cpuUsage = parseFloat(slice[1]);
                const algorithmName = podToAlgorithm.get(r.metric.pod_name);
                if (!algorithmName) {
                    log.warning(`cant find algorithm name by pod ${r.metric.pod_name}`, { component });
                }
                else if (algorithms.has(algorithmName)) {
                    const a = algorithms.get(algorithmName);
                    a.cpuUsage.push(cpuUsage);
                }
                else {
                    algorithms.set(algorithmName, { cpuUsage: [cpuUsage], runTime: [] });
                }
            });
        });
        resources.runTime.data.result.forEach(algorithm => {
            algorithm.values.forEach(slice => {
                const runTime = parseFloat(slice[1]);
                if (algorithms.has(algorithm.metric.algorithmName)) {
                    const a = algorithms.get(algorithm.metric.algorithmName);
                    a.runTime.push(runTime);
                }
                else {
                    algorithms.set(algorithm.metric.algorithmName, { runTime: [runTime] });
                }
            });
        });
        algorithms.forEach((val, key) => result.push({ algorithmName: key, runTime: median(val.runTime), cpuUsage: median(val.cpuUsage) }));
        this._cache.set(result);
        return result;
    }

    async _getResources() {
        const currentDate = Date.now();
        const hoursBefore = new Date(currentDate - (48 * 60 * 60 * 1000));
        const start = hoursBefore / 1000;
        const end = currentDate / 1000;
        const step = 60;
        const [algorithms, cpuUsage, runTime] = await Promise.all([
            client.range({
                query: 'rate(kube_pod_labels{label_algorithm_name!~""}[30m])',
                start,
                end,
                step
            }),
            client.range({
                query: 'sum (rate (container_cpu_usage_seconds_total{container_name="algorunner"}[30m])) by (pod_name)',
                start,
                end,
                step
            }),
            client.range({
                query: 'algorithm_runtime_summary{quantile="0.5", algorithmName!~""}',
                start,
                end,
                step
            })
        ]);
        return { algorithms, cpuUsage, runTime };
    }
}

module.exports = PrometheusAdapter;
