const config = {};
config.transport = {
    console: false,
    logstash: false,
    fluentd: false,
    file: false
};
config.logstash = {
    logstashURL: '127.0.0.1',
    logstashPort: 28777
};
config.extraDetails = false;
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 2;
config.isDefault = true;
module.exports = config;
