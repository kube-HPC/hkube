const path = require('path');
const packageJson = require(process.cwd() + '/package.json');
const formatter = require(process.cwd() + '/lib/utils/formatters');

const config = {};
config.serviceName = packageJson.name;
config.systemVersion = process.env.HKUBE_SYSTEM_VERSION;

const secured = !!process.env.API_SERVER_SSL;
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.maxStorageFetchKeys = formatter.parseInt(process.env.MAX_STORAGE_FETCH_KEYS, 100);
config.storageResultsThreshold = process.env.STORAGE_RESULTS_THRESHOLD || '100Ki';
const storageEncoding = process.env.STORAGE_ENCODING || 'bson';

config.version = packageJson.version;

config.rest = {
    port: process.env.API_SERVER_REST_PORT || 3000,
    prefix: 'api',
    poweredBy: 'HKube Server',
    rateLimit: {
        route: '/api',
        ms: process.env.API_SERVER_RATE_LIMIT_MS || 1000,
        max: process.env.API_SERVER_RATE_LIMIT_MAX || 5,
        delay: process.env.API_SERVER_RATE_LIMIT_DELAY || 0
    }
};

config.cachingServer = {
    protocol: 'http',
    host: process.env.CACHING_SERVICE_SERVICE_HOST || 'localhost',
    port: process.env.CACHING_SERVICE_SERVICE_PORT || 9005,
    prefix: 'cache'
};

config.dataSourceService = {
    protocol: 'http',
    host: process.env.DATASOURCES_SERVICE_SERVICE_HOST || 'localhost',
    port: process.env.DATASOURCES_SERVICE_SERVICE_PORT || 3005,
    prefix: 'api/v1'
};

config.ingressPrefix = process.env.INGRESS_PREFIX || '';

config.debugUrl = {
    path: path.join(config.ingressPrefix, 'hkube/debug')
};

config.addDefaultAlgorithms = process.env.ADD_DEFAULT_ALGORITHMS || true;

config.swagger = {
    protocol: secured ? 'https' : 'http',
    host: process.env.BASE_URL_HOST || 'localhost',
    port: process.env.BASE_URL_PORT || config.rest.port,
    path: process.env.BASE_URL_PATH? path.join(config.ingressPrefix, process.env.BASE_URL_PATH): config.ingressPrefix
};

config.jobs = {
    producer: {
        enableCheckStalledJobs: false,
        prefix: 'pipeline-driver-queue',
        jobType: 'pipeline-job'
    }
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

config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
    serviceName: config.serviceName
};

config.webhooks = {
    retryStrategy: {
        maxAttempts: 3,
        retryDelay: 5000
    }
};

config.clusterName = process.env.CLUSTER_NAME || 'local';

config.pipelineDriversResources = {
    cpu: parseFloat(process.env.PIPELINE_DRIVER_CPU || 0.15),
    mem: parseFloat(process.env.PIPELINE_DRIVER_MEM || 2048)
};

config.metrics = {
    prefix: 'hkube_',
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT
    }
};

config.tracer = {
    tracerConfig: {
        serviceName: config.serviceName,
        reporter: {
            agentHost: process.env.JAEGER_AGENT_SERVICE_HOST || 'localhost',
            agentPort: process.env.JAEGER_AGENT_SERVICE_PORT_AGENT_BINARY || 6832
        }
    }
};

config.s3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000'
};

config.fs = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage'
};

config.storageAdapters = {
    s3: {
        connection: config.s3,
        encoding: storageEncoding,
        moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
    },
    etcd: {
        connection: config.etcd,
        moduleName: process.env.STORAGE_MODULE || '@hkube/etcd-adapter'
    },
    redis: {
        connection: config.redis,
        moduleName: process.env.STORAGE_MODULE || '@hkube/redis-storage-adapter'
    },
    fs: {
        connection: config.fs,
        encoding: storageEncoding,
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};

module.exports = config;
