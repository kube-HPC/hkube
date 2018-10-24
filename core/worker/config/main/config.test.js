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

config.timeouts = {
    stop: 10000, // timeout to stop the algorithm in ms
    inactive: process.env.INACTIVE_WORKER_TIMEOUT_MS || (600 * 1000),
    inactivePaused: process.env.INACTIVE_PAUSED_WORKER_TIMEOUT_MS || (600 * 1000),
    algorithmDisconnected: process.env.ALGORITHM_DISCONNECTED_TIMEOUT_MS || (600 * 1000)
};

module.exports = config;
