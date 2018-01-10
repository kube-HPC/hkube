const packageJson = require(process.cwd() + '/package.json'); // eslint-disable-line
const config = {};

config.serviceName = packageJson.name;
const useCluster = process.env.REDIS_CLUSTER_SERVICE_HOST ? true : false; // eslint-disable-line
const secured = process.env.API_SERVER_SSL ? true : false; // eslint-disable-line

config.rest = {
    port: process.env.API_SERVER_REST_PORT || 3000,
    prefix: 'api',
    versions: ['/v1', '/v2'],
    poweredBy: 'HKube Server'
};

config.swagger = {
    protocol: secured ? 'https' : 'http',
    host: process.env.BASE_URL_HOST || 'localhost',
    port: process.env.BASE_URL_PORT || config.rest.port,
    path: (process.env.BASE_URL_PATH || '') + `/${config.rest.prefix}${config.rest.versions[0]}`
};

config.redis = {
    host: useCluster ? process.env.REDIS_CLUSTER_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useCluster ? process.env.REDIS_CLUSTER_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    cluster: useCluster
};

config.etcd = {
    protocol: 'http',
    host: process.env.ETCD_CLIENT_SERVICE_HOST || 'localhost',
    port: process.env.ETCD_CLIENT_SERVICE_PORT || 4001
};

config.webhooks = {
    progress: {
        maxAttempts: 3,
        retryDelay: 5000
    },
    result: {
        maxAttempts: 3,
        retryDelay: 5000
    }
};

config.metrics = {
    collectDefault: true,
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
