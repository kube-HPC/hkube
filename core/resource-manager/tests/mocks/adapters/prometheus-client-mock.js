const prometheusPipelines = require('../data/prometheus-drivers-progress.json');
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
        let result = null;
        if (options.query.indexOf('kube_pod_labels{label_algorithm_name!~""}') !== -1) {
            result = prometheusCpuUsage;
        }
        else if (options.query.indexOf('pipelines_progress_gauge') !== -1) {
            result = prometheusPipelines;
        }
        else if (options.query.indexOf('algorithm_runtime_summary') !== -1) {
            result = prometheusRunTime;
        }
        return result;
    }
}

module.exports = new Client();
