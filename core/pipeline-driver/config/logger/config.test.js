const config = {};
config.transport = {
    console: false,
    fluentd: false,
    logstash: false,
    file: false,
    redis: false
};
config.verbosityLevel = 2;
module.exports = config;
