const config = {};
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
    clientVerbosity: process.env.CLIENT_VERBOSITY || 'error'
};

config.transport = {
    console: false,
    logstash: false,
    fluentd: false,
    file: false,
    redis: false
};

config.throttle = {
    wait: 30000
};

config.extraDetails = false;
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 2;
config.isDefault = true;
module.exports = config;
