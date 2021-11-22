const config = {};
config.driversSetting = {
    minAmount: 20,
    scalePercent: 0.2,
    concurrency: 5,
};

config.algorithmQueueBalancer = {
    limit: 2,
};

module.exports = config;
