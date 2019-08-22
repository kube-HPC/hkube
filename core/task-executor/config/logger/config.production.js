const config = {};
config.transport = {
    console: false,
    fluentd: true,
    logstash: false,
    file: false,
    redis: true
};
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 1;
module.exports = config;
