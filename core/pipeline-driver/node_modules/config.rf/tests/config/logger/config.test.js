var config = module.exports = {};

config.transport = {
    console: true,
    fluentd: false,
    logstash: false,
    file: false
};

config.logstash = {
    logstashURL: 'localhost'
};
config.verbosityLevel = 0;