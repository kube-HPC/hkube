const packageJson = require(process.cwd() + '/package.json'); // eslint-disable-line
const formatter = require(process.cwd() + '/lib/utils/formatters'); // eslint-disable-line
const config = {};
const heuristicsNames = require('../../lib/consts/heuristics-name');

config.serviceName = packageJson.name;
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;

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

config.algorithmType = process.env.ALGORITHM_TYPE;

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
    maxPersistencySize: process.env.MAX_PERSISTENCY_SIZE || '1e6'
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

module.exports = config;
