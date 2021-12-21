const config = {};
config.unScheduledAlgorithms = {
    interval: process.env.SCHEDULING_WARNING_INTERVAL || 1000,
};
config.db = {
    mongo: {
        dbName: process.env.MONGODB_DB_NAME || 'tests',
    }
};
config.discoveryInterval = 1000;
module.exports = config;