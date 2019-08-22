const config = {};
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;
config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
    clientVerbosity: process.env.CLIENT_VERBOSITY || 'error'
};
config.transport = {
    console: true,
    fluentd: false,
    logstash: false,
    file: false
};
config.logstash = {
    logstashURL: 'localhost',
    logstashPort: 28777
};
config.extraDetails = false;
config.isDefault = true;
config.verbosityLevel = 2;
module.exports = config;
