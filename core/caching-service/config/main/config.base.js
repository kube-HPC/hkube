const packageJson = require(process.cwd() + '/package.json');

const config = {};
config.serviceName = packageJson.name;
config.version = packageJson.version;
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;

config.rest = {
    port: process.env.CACHING_SERVICE || 9005,
    prefix: '/',
    poweredBy: 'HKube Server',
    rateLimit: {
        route: '/',
        ms: process.env.API_SERVER_RATE_LIMIT_MS || 1000,
        max: process.env.API_SERVER_RATE_LIMIT_MAX || 5,
        delay: process.env.API_SERVER_RATE_LIMIT_DELAY || 0
    }
};

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

module.exports = config;
