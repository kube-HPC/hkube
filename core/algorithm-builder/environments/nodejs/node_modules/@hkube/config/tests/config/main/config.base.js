var config = module.exports = {};

config.serviceName = 'config-it-test';

config.redis = {
    host: process.env.REDIS_SERVICE_HOST || 'localhost',
    port: process.env.REDIS_SERVICE_PORT || 6379
};
