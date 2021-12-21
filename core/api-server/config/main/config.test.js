const config = {};

config.defaultStorage = process.env.DEFAULT_STORAGE || 'fs';
config.rest = {
    rateLimit: null
};

config.db = {
    mongo: {
        dbName: process.env.MONGODB_DB_NAME || 'tests',
    }
};

module.exports = config;
