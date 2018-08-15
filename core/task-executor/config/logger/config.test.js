const config = {};
config.transport = {
    console: true,
    fluentd: false,
    logstash: false,
    file: false
};
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 0;
module.exports = config;
