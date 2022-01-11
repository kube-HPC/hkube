const config = {};
config.unScheduledAlgorithms = {
    interval: process.env.SCHEDULING_WARNING_INTERVAL || 1000,
};

config.discoveryInterval = 1000;
module.exports = config;