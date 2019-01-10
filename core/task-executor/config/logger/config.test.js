const config = {};
config.transport = {
    console: process.env.SHOW_TEST_LOGS,
    fluentd: false,
    logstash: false,
    file: false
};
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 0;
module.exports = config;
