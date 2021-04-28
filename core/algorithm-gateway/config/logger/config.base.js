const config = {};

config.transport = {
    console: false
};
config.throttle = {
    wait: 30000
};

config.enableColors = false;
config.format = 'wrapper::{level}::{message}';
config.extraDetails = false;
config.verbosityLevel = process.env.HKUBE_LOG_LEVEL || 2;
config.isDefault = true;
module.exports = config;
