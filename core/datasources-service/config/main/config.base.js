const path = require('path');
const packageJson = require(process.cwd() + '/package.json');
const formatter = require(process.cwd() + '/lib/utils/formatters');

const config = {};
config.serviceName = packageJson.name;
config.systemVersion = process.env.HKUBE_SYSTEM_VERSION;
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
const storageEncoding = process.env.STORAGE_ENCODING || 'bson';

const secured = !!process.env.DATASOURCE_SERVICE_SSL;
config.defaultStorage = process.env.DEFAULT_STORAGE || 'fs';
config.maxStorageFetchKeys = formatter.parseInt(
    process.env.MAX_STORAGE_FETCH_KEYS,
    100
);
config.storageResultsThreshold =
    process.env.STORAGE_RESULTS_THRESHOLD || '100Ki';

config.version = packageJson.version;

config.rest = {
    port: process.env.DATASOURCE_SERVICE_REST_PORT || 3005,
    prefix: 'api',
    poweredBy: 'HKube Server',
    rateLimit: {
        route: '/api',
        ms: process.env.DATASOURCE_SERVICE_RATE_LIMIT_MS || 1000,
        max: process.env.DATASOURCE_SERVICE_RATE_LIMIT_MAX || 5,
        delay: process.env.DATASOURCE_SERVICE_RATE_LIMIT_DELAY || 0,
    },
};

config.cachingServer = {
    protocol: 'http',
    host: process.env.CACHING_SERVICE_SERVICE_HOST || 'localhost',
    port: process.env.CACHING_SERVICE_SERVICE_PORT || 9005,
    prefix: 'cache',
};

config.debugUrl = {
    path: path.join(process.env.INGRESS_PREFIX || '', 'hkube/debug'),
};

config.swagger = {
    protocol: secured ? 'https' : 'http',
    host: process.env.BASE_URL_HOST || 'localhost',
    port: process.env.BASE_URL_PORT || config.rest.port,
    path: process.env.BASE_URL_PATH || '',
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
        dbName: process.env.MONGODB_SERVICE_NAME || 'hkube',
        useUnifiedTopology: true,
    },
};

config.clusterName = process.env.CLUSTER_NAME || 'local';

config.metrics = {
    prefix: 'hkube_',
    collectDefault: true,
    server: {
        port: process.env.METRICS_PORT,
    },
};

config.tracer = {
    tracerConfig: {
        serviceName: config.serviceName,
        reporter: {
            agentHost: process.env.JAEGER_AGENT_SERVICE_HOST || 'localhost',
            agentPort:
                process.env.JAEGER_AGENT_SERVICE_PORT_AGENT_BINARY || 6832,
        },
    },
};

config.s3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY ||
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000',
};

config.fs = {
    baseDirectory:
        process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage',
};

config.git = {
    user: {
        name: process.env.GIT_USER_NAME || 'hkube',
        password: process.env.GIT_PASSWORD || '123456',
    },
    endpoint: process.env.GIT_ENDPOINT_URL || 'localhost:3010',
};

config.directories = {
    temporaryGitRepositories: 'temp/datasource-git-repositories',
    dataSourcesInUse: 'temp/dataSources-in-use',
};

config.redis = {
    host: useSentinel
        ? process.env.REDIS_SENTINEL_SERVICE_HOST
        : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel
        ? process.env.REDIS_SENTINEL_SERVICE_PORT
        : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001,
};

config.jobs = {
    consumer: {
        prefix: 'data-sources',
        type: 'data-sources-job',
        concurrency: 10000,
    },
};

config.storageAdapters = {
    s3: {
        connection: config.s3,
        encoding: storageEncoding,
        moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter',
    },
    etcd: {
        connection: config.etcd,
        moduleName: process.env.STORAGE_MODULE || '@hkube/etcd-adapter',
    },
    redis: {
        connection: config.redis,
        moduleName:
            process.env.STORAGE_MODULE || '@hkube/redis-storage-adapter',
    },
    fs: {
        connection: config.fs,
        encoding: storageEncoding,
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter',
    },
};

module.exports = config;
