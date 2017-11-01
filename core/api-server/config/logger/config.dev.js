var config = module.exports = {};

config.transport = {
    console: true,
    fluentd: false,
    logstash: false,
    file: false
};

config.logstash = {
    logstashURL: '127.0.0.1'
};

config.verbosityLevel = 2;
