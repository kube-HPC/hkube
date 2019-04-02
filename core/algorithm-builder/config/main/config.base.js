const packageJson = require(process.cwd() + '/package.json');
const config = {};
config.serviceName = packageJson.name;

const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.clusterName = process.env.CLUSTER_NAME || 'local';
config.version = packageJson.version;
config.buildId = process.env.BUILD_ID;

config.docker = {
    registry: process.env.DOCKER_REGISTRY || '',
    namespace: process.env.DOCKER_NAMESPACE || 'hkube',
    user: process.env.DOCKER_REGISTRY_USER || '',
    pass: process.env.DOCKER_REGISTRY_PASS || ''
};

config.buildDirs = {
    ZIP: 'uploads/zipped',
    UNZIP: 'uploads/unzipped'
}

config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || '127.0.0.1',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
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
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};

module.exports = config;
