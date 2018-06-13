const packageJson = require(process.cwd() + '/package.json');
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
    host: process.env.ETCD_CLIENT_SERVICE_HOST || 'localhost',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
};

config.consumer = {
    prefix: 'pipeline-driver-queue',
    jobType: 'pipeline-job'
};

config.producer = {
    prefix: 'pipeline-driver',
    jobType: 'pipeline-job'
};

config.queue = {
    updateInterval: 1000
};

config.heuristicsWeights = {
    [heuristicsNames.PRIORITY]: 0.5,
    [heuristicsNames.ENTRANCE_TIME]: 0.5
};

config.metrics = {
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
