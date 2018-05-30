const config = {};
config.transport = {
    console: false,
    fluentd: true,
    logstash: false,
    file: false
};
config.verbosityLevel = 2;
module.exports = config;
