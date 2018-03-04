const packageJson = require(process.cwd() + '/package.json'); // eslint-disable-line
const config = {};

config.serviceName = packageJson.name;
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
    path: (process.env.BASE_URL_PATH || '')
};

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

config.webhooks = {
    retryStrategy: {
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

config.datastoreAdapter = {
    connection: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        endpoint: process.env.AWS_ENDPOINT || 'http://127.0.0.1:9000'
    },
    moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
};

module.exports = config;
