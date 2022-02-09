const config = {};
config.driversSetting = {
    minAmount: 20,
    scalePercent: 0.2,
    concurrency: 5,
};

config.algorithmQueueBalancer = {
    limit: 2,
};

config.devenvs = {
    enable: true
};

config.healthchecks = {
    port: process.env.HEALTHCHECK_PORT || '5656',
};

module.exports = config;
