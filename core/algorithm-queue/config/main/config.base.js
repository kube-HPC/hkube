const packageJson = require(process.cwd() + '/package.json'); // eslint-disable-line
const formatter = require(process.cwd() + '/lib/utils/formatters'); // eslint-disable-line
const heuristicsNames = require('../../lib/consts/heuristics-name');
const config = {};
config.version = packageJson.version;
config.serviceName = packageJson.name;
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
config.queueId = process.env.QUEUE_ID || 'stam';
const storageEncoding = process.env.STORAGE_ENCODING || 'bson';
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.clusterName = process.env.CLUSTER_NAME || 'local';

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

config.algorithmQueueBalancer = {
    limit: formatter.parseInt(process.env.CONCURRENCY_LIMIT, 5),
    minIdleTimeMS: formatter.parseInt(process.env.ALGORITHM_QUEUE_MIN_IDLE_TIME, 30000),
    livenessInterval: formatter.parseInt(process.env.ALGORITHM_QUEUE_LIVENESS_INTERVAL, 5000),
    algorithmMinIdleTimeMS: formatter.parseInt(process.env.ALGORITHM_QUEUE_ALGORITHM_MIN_IDLE_TIME, 5 * 60 * 60 * 1000),
};

config.producer = {
    checkStalledJobsInterval: process.env.STALLED_JOB_INTERVAL || 15000,
    enableCheckStalledJobs: true,
    prefix: 'jobs-workers'
};

config.producerUpdateInterval = process.env.PRODUCER_UPDATE_INTERVAL || '1000';

config.consumer = {
    concurrency: 10000,
    prefix: 'algorithm-queue'
};

config.queue = {
    updateInterval: process.env.INTERVAL || 1000,
    maxPersistencySize: process.env.MAX_PERSISTENCY_SIZE || '10e6'
};

config.heuristicsWeights = {
    [heuristicsNames.ATTEMPTS]: 0.2,
    [heuristicsNames.PRIORITY]: 0.4,
    [heuristicsNames.ENTRANCE_TIME]: 0.2,
    [heuristicsNames.BATCH]: 0.1,
    [heuristicsNames.CURRENT_BATCH_PLACE]: 0.1
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

config.logging = {
    tasks: formatter.parseBool(process.env.LOG_TASKS, true)
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
