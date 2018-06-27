const prometheusAlgorithms = require('../data/prometheus-algorithms.json');
const prometheusCpuUsage = require('../data/prometheus-cpu-usage.json');
const prometheusRunTime = require('../data/prometheus-run-time.json');

class Client {

    init() {
        return;
    }

    async query() {
        return;
    }

    async range(options) {
        const result = { data: { result: null } };
        switch (options.query) {
            case 'rate(kube_pod_labels{label_algorithm_name!~""}[30m])':
                result.data.result = prometheusAlgorithms;
                break;
            case 'sum (rate (container_cpu_usage_seconds_total{container_name="algorunner"}[30m])) by (pod_name)':
                result.data.result = prometheusCpuUsage;
                break;
            case 'algorithm_runtime_summary{quantile="0.5", algorithmName!~""}':
                result.data.result = prometheusRunTime;
                break;
        };
        return result;
    }
}

module.exports = new Client();
