const config = {};

config.defaultStorage = process.env.DEFAULT_STORAGE || 'fs';
config.debugger = {}
config.debugger.communication = {
    host: 'localhost',
    protocol: 'ws',
    port: '3100'
};

module.exports = config;
