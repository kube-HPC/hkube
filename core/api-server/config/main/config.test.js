const config = {};

config.defaultStorage = process.env.DEFAULT_STORAGE || 'fs';
config.rest = {
    rateLimit: null
};
config.healthchecks = {
    checkInterval: 1000,
    minAge: 2000,
    enabled: false
}
module.exports = config;
