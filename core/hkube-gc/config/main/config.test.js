const config = {};
config.kubernetes = {
    isLocal: true,
};
config.fs = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || 'var/tmp/storage'
};

module.exports = config;

