

const config = {};
config.serviceName = 'algorunner';

config.logger = {
    isDefault: true,
    format: 'wrapper::{level}::{message}',
    verbosityLevel: process.env.HKUBE_LOG_LEVEL || 2,
    transport: {
        console: true,
    },
    throttle: {
        wait: 30000
    },
};

module.exports = config;

