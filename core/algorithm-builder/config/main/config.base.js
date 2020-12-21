const packageJson = require(process.cwd() + '/package.json');
const { parseBool, parseInt } = require(process.cwd() + '/lib/utils/formatters');
const config = {};
config.serviceName = packageJson.name;

const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.clusterName = process.env.CLUSTER_NAME || 'local';
config.version = packageJson.version;
config.buildId = process.env.BUILD_ID;
config.testMode = process.env.TEST_MODE === 'True';
config.testModeEnv = process.env.TEST_MODE_ENV || 'nodejs';
config.buildMode = process.env.BUILD_MODE || 'kaniko'

config.docker = {
    pull: {
        registry: process.env.DOCKER_PULL_REGISTRY || 'docker.io',
        namespace: process.env.DOCKER_PULL_NAMESPACE || 'hkube',
        user: process.env.DOCKER_PULL_USERNAME || '',
        pass: process.env.DOCKER_PULL_PASSWORD || '',
        insecure: parseBool(process.env.DOCKER_PULL_INSECURE, false),
        skip_tls_verify: parseBool(process.env.DOCKER_PULL_SKIP_TLS_VERIFY, false)
    },
    push: {
        registry: process.env.DOCKER_PUSH_REGISTRY || 'docker.io',
        namespace: process.env.DOCKER_PUSH_NAMESPACE || '',
        user: process.env.DOCKER_PUSH_USERNAME || '',
        pass: process.env.DOCKER_PUSH_PASSWORD || '',
        insecure: parseBool(process.env.DOCKER_PUSH_INSECURE, false),
        skip_tls_verify: parseBool(process.env.DOCKER_PUSH_SKIP_TLS_VERIFY, false)
    }
};

config.kubernetes = {
    isLocal: !!process.env.KUBERNETES_SERVICE_HOST,
    namespace: process.env.NAMESPACE || 'default'
};

config.packagesRepo = {
    nodejs: {
        registry: process.env.NPM_REGISTRY || '',
        token: process.env.NPM_TOKEN || '',
        auth: process.env.NPM_AUTH || '',
        defaultBaseImage: process.env.NODE_DEFAULT_BASE_IMAGE || 'node:14.5.0-slim',
        wrapperVersion: process.env.NODE_WRAPPER_VERSION || ''
    },
    python: {
        registry: process.env.PIP_REGISTRY || '',
        token: process.env.PIP_TOKEN || '',
        defaultBaseImage: process.env.PYTHON_DEFAULT_BASE_IMAGE || 'python:3.7',
        wrapperVersion: process.env.PYTHON_WRAPPER_VERSION || ''
    },
    java: {
        registry: process.env.MAVEN_REGISTRY || 'https://repo1.maven.org/maven2',
        token: process.env.MAVEN_TOKEN || '_',
        user: process.env.MAVEN_USER || '_',
        defaultBaseImage: process.env.JAVA_DEFAULT_BASE_IMAGE || 'hkube/openjdk11:jre-11.0.8_10-ubuntu'
    }

};

config.tmpFolder = process.env.TMP_FOLDER || '/tmp';

config.buildDirs = {
    ZIP: 'uploads/zipped',
    UNZIP: 'uploads/unzipped'
};

config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel
};

config.db = {
    provider: 'mongo',
    mongo: {
        auth: {
            user: process.env.MONGODB_SERVICE_USER_NAME || 'tester',
            password: process.env.MONGODB_SERVICE_PASSWORD || 'password',
        },
        host: process.env.MONGODB_SERVICE_HOST || 'localhost',
        port: parseInt(process.env.MONGODB_SERVICE_PORT, 27017),
        dbName: process.env.MONGODB_DB_NAME || 'hkube',
    }
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
        encoding: process.env.STORAGE_ENCODING || 'bson',
        moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
    },
    etcd: {
        encoding: process.env.STORAGE_ENCODING || 'bson',
        connection: config.etcd,
        moduleName: process.env.STORAGE_MODULE || '@hkube/etcd-adapter'
    },
    redis: {
        connection: config.redis,
        moduleName: process.env.STORAGE_MODULE || '@hkube/redis-storage-adapter'
    },
    fs: {
        connection: config.fs,
        encoding: process.env.STORAGE_ENCODING || 'bson',
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};

module.exports = config;
