const config = {};

config.transport = {
    console: true
};
config.console = {
    json: false,
    colors: false,
    format: 'wrapper::{level}::{message}',
    level: process.env.HKUBE_LOG_LEVEL
};
config.options = {
    throttle: {
        wait: 30000
    }
};
module.exports = config;
