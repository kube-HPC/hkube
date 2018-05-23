var config = module.exports = {};

config.transport = {
    console: false,
    fluentd: true,
    logstash: false,
    file: false
};

config.logstash = {
    logstashURL: 'localhost'
};

config.verbosityLevel = 2;
