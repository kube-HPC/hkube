const config = {};

config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.rest = {
    rateLimit: null,
};

module.exports = config;
