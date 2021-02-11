const formatter = require(process.cwd() + '/lib/helpers/formatters');

const config = {};
config.workerCommunication = {
    adapterName: 'loopback'
};

config.streaming = {
    autoScaler: {
        interval: 60000,
        minTimeWaitBeforeScaleUp: 100,
        minTimeWaitBeforeScaleDown: 100,
        maxSizeWindow: 4,
        minTimeNonStatsReport: 5000,
        maxScaleUpReplicas: 10,
        maxTimeIdleBeforeReplicaDown: 0
    },
    serviceDiscovery: {
        interval: 60000
    },
    election: {
        interval: 60000
    },
    metrics: {
        interval: 60000
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
