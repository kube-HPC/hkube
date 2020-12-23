const packageJson = require(process.cwd() + '/package.json');
const formatter = require(process.cwd() + '/lib/utils/formatters');
const config = module.exports = {};

config.serviceName = packageJson.name;

config.recommendationMode = 'flat';  // flat, map

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
};

config.db = {
    provider: 'mongo',
    mongo: {
        auth: {
            user: process.env.MONGODB_SERVICE_USER_NAME || 'tester',
            password: process.env.MONGODB_SERVICE_PASSWORD || 'password',
        },
        host: process.env.MONGODB_SERVICE_HOST || 'localhost',
        port: formatter.parseInt(process.env.MONGODB_SERVICE_PORT, 27017),
        dbName: process.env.MONGODB_DB_NAME || 'hkube',
    }
};

config.prometheus = {
    endpoint: process.env.PROMETHEUS_ENDPOINT
};

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default',
    version: '1.9'
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
    prefix: 'hkube_',
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT
    }
};
