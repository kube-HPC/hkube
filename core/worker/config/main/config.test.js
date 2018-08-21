const config = {};
config.workerCommunication = {
    adapterName: 'loopback',
    config: {}
};

config.jobConsumer = {
    job: {
        type: 'test-type'
    },
    setting: {
        prefix: 'jobs-workers',
        settings: {
            maxStalledCount: 3
        }
    }
};

module.exports = config;
