const config = {};
config.transport = {
    console: false,
    logstash: false,
    fluentd: true,
    file: false
};
config.verbosityLevel = 0;
module.exports = config;
