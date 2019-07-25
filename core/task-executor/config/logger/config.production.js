const config = {};
config.transport = {
    console: false,
    fluentd: true,
    logstash: false,
    file: false
};
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 1;
module.exports = config;
