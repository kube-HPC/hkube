const config = {};
const useSentinel = !!process.env.REDIS_SENTINEL_SERVICE_HOST;

config.transport = {
    console: false,
    file: !!process.env.HKUBE_LOG_FILE_ENABLED,
    redis: false,
};
config.console = {
    json: false
};
config.file = {
    json: true,
    filename: process.env.HKUBE_LOG_FILE_NAME || 'hkube-logs/file.log',
    maxsize: process.env.HKUBE_LOG_FILE_MAX_SIZE || 100000,
    maxFiles: process.env.HKUBE_LOG_FILE_MAX_FILES || 1000
};
config.redis = {
    host: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_HOST : process.env.REDIS_SERVICE_HOST || 'localhost',
    port: useSentinel ? process.env.REDIS_SENTINEL_SERVICE_PORT : process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: useSentinel,
    clientVerbosity: process.env.CLIENT_VERBOSITY || 'error'
};
config.options = {
    throttle: {
        wait: 30000
    },
    verbosityLevel: process.env.HKUBE_LOG_LEVEL || 2,
    extraDetails: false,
    isDefault: true
}
module.exports = config;
