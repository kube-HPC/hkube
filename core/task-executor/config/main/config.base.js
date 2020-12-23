const packageJson = require(process.cwd() + '/package.json');
const formatter = require('../../lib/helpers/formatters');
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
    hasNodeList: formatter.parseBool(process.env.HAS_NODE_LIST, false),
    isPrivileged: formatter.parseBool(process.env.IS_PRIVILEGED, true),
    labels: {
        gpu: process.env.GPU_NODE_SELECTOR_LABEL || 'hkube-gpu'
    }
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
    serviceName: config.serviceName
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

config.jaeger = {
    host: process.env.JAEGER_AGENT_SERVICE_HOST,
}

config.driversSetting = {
    name: 'pipeline-driver',
    minAmount: parseInt(process.env.PIPELINE_DRIVERS_AMOUNT || 30, 10),
    scalePercent: parseFloat(process.env.PIPELINE_DRIVERS_SCALE_PERCENT || 0.2),
    reconcileInterval: parseInt(process.env.PIPELINE_DRIVERS_RECONCILE_INTERVAL || 30000, 10)
};

config.metrics = {
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT
    }
};

config.resources = {
    enable: formatter.parseBool(process.env.RESOURCES_ENABLE, false),
    worker: {
        mem: parseFloat(process.env.WORKER_MEMORY) || 512,
        cpu: parseFloat(process.env.WORKER_CPU) || 0.5
    },
    defaultQuota: {
        'limits.cpu': parseFloat(process.env.DEFAULT_QUOTA_CPU) || 30,
        'limits.memory': process.env.DEFAULT_QUOTA_MEM || '20Gi',
        'requests.nvidia.com/gpu': process.env.DEFAULT_QUOTA_GPU || 0
    },
    useResourceLimits: formatter.parseBool(process.env.USE_RESOURCE_LIMITS, false),

}

config.healthchecks = {
    path: process.env.HEALTHCHECK_PATH || '/healthz',
    port: process.env.HEALTHCHECK_PORT || '5000',
    maxDiff: process.env.HEALTHCHECK_MAX_DIFF || '10000',
    logExternalRequests: formatter.parseBool(process.env.LOG_EXTERNAL_REQUESTS, true),
    enabled: formatter.parseBool(process.env.HEALTHCHECKS_ENABLE, true)
}

config.cacheResults = {
    enabled: formatter.parseBool(process.env.CACHE_RESULTS_ENABLE, true)
}