const packageJson = require(process.cwd() + '/package.json');
const formatter = require('../../lib/helpers/formatters');
const config = module.exports = {};

config.serviceName = packageJson.name;
config.version = packageJson.version;
config.intervalMs = process.env.INTERVAL_MS || 10000;
config.boardsIntervalMs = process.env.BOARDS_INTERVAL_MS || 2000;
config.boardTimeOut = formatter.parseInt(process.env.BOARDS_TIMEOUT, 3 * 60 * 60) * 1000;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.buildMode = process.env.BUILD_MODE || 'kaniko'

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

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default',
    isPrivileged: formatter.parseBool(process.env.IS_PRIVILEGED, true),
    version: '1.9'
};

config.jaeger = {
    host: process.env.JAEGER_AGENT_SERVICE_HOST,
}
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
    enable: formatter.parseBool(process.env.RESOURCES_ENABLE, false)
};

config.healthchecks = {
    path: process.env.HEALTHCHECK_PATH || '/healthz',
    port: process.env.HEALTHCHECK_PORT || '5000',
    maxDiff: process.env.HEALTHCHECK_MAX_DIFF || '30000',
    logExternalRequests: formatter.parseBool(process.env.LOG_EXTERNAL_REQUESTS, true)
};
