const formatter = require(process.cwd() + '/lib/helpers/formatters');
const config = {};
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;

config.transport = {
    console: false,
    file: formatter.parseBool(process.env.HKUBE_LOG_FILE_ENABLED, false),
    redis: false,
};
config.console = {
    json: false,
    colors: false,
    level: process.env.HKUBE_LOG_LEVEL,
};
config.file = {
    json: true,
    level: process.env.HKUBE_LOG_LEVEL,
    filename: process.env.HKUBE_LOG_FILE_NAME || 'hkube-logs/file.log',
    maxsize: formatter.parseInt(process.env.HKUBE_LOG_FILE_MAX_SIZE, 200000),
    maxFiles: formatter.parseInt(process.env.HKUBE_LOG_FILE_MAX_FILES, 20)
};
config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
    level: process.env.HKUBE_LOG_REDIS_LEVEL || 'error',
};
config.options = {
    throttle: {
        wait: 30000
    },
    extraDetails: false,
}
module.exports = config;
