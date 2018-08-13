const packageJson = require(process.cwd() + '/package.json');
const config = module.exports = {};

config.serviceName = packageJson.name;

config.recommendationMode = 'map';  // flat, map

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
};

config.prometheus = {
    endpoint: process.env.PROMETHEUS_ENDPOINT
};

config.k8s = {
    local: !process.env.KUBERNETES_SERVICE_HOST
};

config.interval = process.env.INTERVAL || 1000;

config.resourceThresholds = {
    algorithms: {
        cpu: process.env.ALGORITHMS_THRESHOLD_CPU || 0.9,
        mem: process.env.ALGORITHMS_THRESHOLD_MEM || 0.9
    },
    pipelineDrivers: {
        cpu: process.env.DRIVERS_THRESHOLD_CPU || 0.6,
        mem: process.env.DRIVERS_THRESHOLD_MEM || 1
    }
};

config.metricsMeasure = {
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT
    }
};
