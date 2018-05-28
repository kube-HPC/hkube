const config = {};
config.transport = {
    console: true,
    fluentd: false,
    logstash: false,
    file: false
};
config.verbosityLevel = 2;
module.exports = config;
