const config = {};

config.transport = {
    console: true,
    logstash: false,
    fluentd: false,
    file: false
};

config.extraDetails = false;
config.isDefault = true;
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 1;


module.exports = config;
