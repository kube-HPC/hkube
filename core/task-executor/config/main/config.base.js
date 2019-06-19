const packageJson = require(process.cwd() + '/package.json');
const formatter = require(process.cwd() + '/lib/helpers/formatters');
const config = module.exports = {};

config.serviceName = packageJson.name;
config.version = packageJson.version;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.clusterName = process.env.CLUSTER_NAME || 'local';
config.intervalMs = process.env.INTERVAL_MS || '3000';
config.createdJobsTTL = process.env.CREATED_JOBS_TTL || 15 * 1000;

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default',
    isNamespaced: formatter.parseBool(process.env.IS_NAMESPACED, false),
    isPrivileged: formatter.parseBool(process.env.IS_PRIVILEGED, true),
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
    serviceName: config.serviceName
};

config.driversSetting = {
    name: 'pipeline-driver',
    minAmount: parseInt(process.env.PIPELINE_DRIVERS_AMOUNT || 30, 10),
    scalePercent: parseFloat(process.env.PIPELINE_DRIVERS_SCALE_PERCENT || 0.2, 10),
    reconcileInterval: parseInt(process.env.PIPELINE_DRIVERS_RECONCILE_INTERVAL || 30000, 10)
};

config.metrics = {
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT
    }
};


config.resources = {
    worker: {
        mem: parseFloat(process.env.WORKER_MEMORY) || 256,
        cpu: parseFloat(process.env.WORKER_CPU) || 0.1
    }
}