const config = {};

config.rest = {
    rateLimit: null
};


config.storageAdapters = {
    s3: {
        encoding: 'json'
    },
    fs: {
        encoding: 'json'
    }
};

module.exports = config;
