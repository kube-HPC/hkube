const config = {};
config.transport = {
    console: true,
    logstash: false,
    fluentd: false,
    file: false
};
config.throttle = {
    wait: 30000
};
config.extraDetails = false;
config.isDefault = true;
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 2;
module.exports = config;
