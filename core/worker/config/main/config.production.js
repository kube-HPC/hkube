const formatter = require(process.cwd() + '/lib/helpers/formatters');

const config = {};
config.algorunnerLogging = {
    disable: formatter.parseBool(process.env.DISABLE_ALGORITHM_LOGGING || false),
    algorunnerLogFileName: process.env.ALGORITHM_LOG_FILE_NAME,
    baseLogsPath: process.env.BASE_LOGS_PATH
};

config.timeouts = {
    stop: 10000, // timeout to stop the algorithm in ms
    stoppingIntervalCount: formatter.parseInt(process.env.STOPPING_INTERVAL_COUNT, 200), // number of times an algorithm can report stopping
    inactive: formatter.parseInt(process.env.INACTIVE_WORKER_TIMEOUT_MS, 600 * 1000),
    inactivePaused: formatter.parseInt(process.env.INACTIVE_PAUSED_WORKER_TIMEOUT_MS, 30 * 1000),
    algorithmDisconnected: formatter.parseInt(process.env.ALGORITHM_DISCONNECTED_TIMEOUT_MS, 60 * 1000),
};

module.exports = config;
