const config = {};
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
