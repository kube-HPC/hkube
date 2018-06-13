const config = {};
config.transport = {
    console: false,
    logstash: false,
    fluentd: true,
    file: false
};
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 2;
module.exports = config;
