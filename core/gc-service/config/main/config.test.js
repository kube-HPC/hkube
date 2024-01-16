const config = {};
config.kubernetes = {
    isLocal: true,
};
config.fs = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || 'var/tmp/storage'
};

config.healthchecks = {
    enabled: false
};
config.cleanerSettings = {
    taskStatus:{
        cron: process.env.TASKSTATUS_CRON || '* * * * *',
        settings:{
            pdIntervalBreach: 3600000  
        }
    }
}

module.exports = config;

