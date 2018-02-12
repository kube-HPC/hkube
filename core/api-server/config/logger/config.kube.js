const config = {};
config.transport = {
    console: false,
    logstash: false,
    fluentd: true,
    file: false
};
config.verbosityLevel = 2;
module.exports = config;
