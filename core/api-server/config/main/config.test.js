const config = {};

config.defaultStorage = process.env.DEFAULT_STORAGE || 'fs';
config.rest = {
    rateLimit: null
};

module.exports = config;
