const packageJson = require(process.cwd() + '/package.json'); // eslint-disable-line 
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

config.algorithmType = process.env.ALGORITHM_TYPE;

config.consumer = {
    concurrency: 10000
};

config.queue = {
    updateInterval: 1000
};

config.heuristicsWeights = {
    [heuristicsNames.PRIORITY]: 0.4,
    [heuristicsNames.ENTRANCE_TIME]: 0.2,
    [heuristicsNames.BATCH]: 0.2,
    [heuristicsNames.CURRENT_BATCH_PLACE]: 0.2
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
