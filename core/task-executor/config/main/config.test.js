const config = {};
config.driversSetting = {
    minAmount: 20,
    scalePercent: 0.2
};
config.intervalMs = process.env.INTERVAL_MS || 15000;
module.exports = config;
