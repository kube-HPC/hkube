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
config.isDefault = true;
module.exports = config;
