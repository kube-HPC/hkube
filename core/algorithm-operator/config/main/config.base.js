const packageJson = require(process.cwd() + '/package.json');
const formatter = require('../../lib/helpers/formatters');
const config = module.exports = {};

config.serviceName = packageJson.name;
config.version = packageJson.version;
config.intervalMs = process.env.INTERVAL_MS || 10000;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.buildMode = process.env.BUILD_MODE || 'kaniko'

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default',
    version: '1.9'
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
    serviceName: config.serviceName
};

config.resources = {
    algorithmQueue: {
        memory: parseFloat(process.env.ALGORITHM_QUEUE_MEMORY) || 256,
        cpu: parseFloat(process.env.ALGORITHM_QUEUE_CPU) || 0.1
    },
    algorithmBuilderMain: {
        memory: parseFloat(process.env.ALGORITHM_BUILDER_MAIN_MEMORY) || 256,
        cpu: parseFloat(process.env.ALGORITHM_BUILDER_MAIN_CPU) || 0.1,
    },
    algorithmBuilderBuilder: {
        memory: parseFloat(process.env.ALGORITHM_BUILDER_BUILDER_MEMORY) || 256,
        cpu: parseFloat(process.env.ALGORITHM_BUILDER_BUILDER_CPU) || 1
    },
    enable: formatter.parseBool(process.env.ALGORITHM_BUILDER_RESOURCES_ENABLE, false)
};

config.healthchecks = {
    path: process.env.HEALTHCHECK_PATH || '/healthz',
    port: process.env.HEALTHCHECK_PORT || '5000',
    maxDiff: process.env.HEALTHCHECK_MAX_DIFF || '30000',
    logExternalRequests: formatter.parseBool(process.env.LOG_EXTERNAL_REQUESTS, true)
};
