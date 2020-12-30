const packageJson = require(process.cwd() + '/package.json');
const formatter = require(process.cwd() + '/lib/utils/formatters');
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

module.exports = config;
