const formatter = require(process.cwd() + '/lib/helpers/formatters');

const config = {};
config.workerCommunication = {
    adapterName: 'loopback'
};

config.streaming = {
    autoScaler: {
        interval: process.env.AUTO_SCALER_INTERVAL || 60000,
        minTimeWaitForReplicaUp: 0,
        maxSizeWindow: 4,
        minTimeIdleBeforeReplicaDown: 0
    },
    serviceDiscovery: {
        interval: process.env.SERVICE_DISCOVERY_INTERVAL || 60000
    },
    election: {
        interval: process.env.ELECTION_INTERVAL || 60000
    },
    progress: {
        interval: process.env.STREAMING_PROGRESS_INTERVAL || 60000
    }
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

config.kubernetes = {
    isLocal: true,
};

config.timeouts = {
    stop: 10000, // timeout to stop the algorithm in ms
    inactive: formatter.parseInt(process.env.INACTIVE_WORKER_TIMEOUT_MS, 600 * 1000),
    inactivePaused: formatter.parseInt(process.env.INACTIVE_PAUSED_WORKER_TIMEOUT_MS, 600 * 1000),
    algorithmDisconnected: formatter.parseInt(process.env.ALGORITHM_DISCONNECTED_TIMEOUT_MS, 600 * 1000)
};
config.algoMetricsDir = 'var/tmp';

module.exports = config;
