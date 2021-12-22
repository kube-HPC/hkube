const packageJson = require(process.cwd() + '/package.json');
const formatter = require(process.cwd() + '/lib/utils/formatters');
const config = {};
const heuristicsNames = require('../../lib/consts/heuristics-name');

const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
config.serviceName = packageJson.name;
const storageEncoding = process.env.STORAGE_ENCODING || 'bson';
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.clusterName = process.env.CLUSTER_NAME || 'local';

config.rest = {
    port: formatter.parseInt(process.env.REST_PORT, 7100),
    prefix: 'api/v1/driver-queue',
    poweredBy: 'HKube Pipeline Driver queue',
    bodySizeLimit: process.env.BODY_SIZE_LIMIT || '50mb'
};
config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
};

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


config.consumer = {
    prefix: 'pipeline-driver-queue',
    jobType: 'pipeline-job',
    concurrency: 10000
};

config.producer = {
    enableCheckStalledJobs: false,
    prefix: 'pipeline-driver',
    jobType: 'pipeline-job'
};

config.persistence = {
    type: 'pipeline-driver'
};

config.checkQueueInterval = process.env.CHECK_QUEUE_INTERVAL || 500;
config.updateStateInterval = process.env.UPDATE_STATE_INTERVAL || 5000;

config.heuristicsWeights = {
    [heuristicsNames.PRIORITY]: 0.5,
    [heuristicsNames.ENTRANCE_TIME]: 0.5
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

config.scoring = {
    maxSize: formatter.parseInt(process.env.MAX_SCORING_SIZE, 5000)
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
    fs: {
        connection: config.fs,
        encoding: storageEncoding,
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};

module.exports = config;
