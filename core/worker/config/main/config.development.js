const path = require('path');
const formatter = require(process.cwd() + '/lib/helpers/formatters');

const config = {};
config.algorunnerLogging = {
    disable: formatter.parseBool(process.env.DISABLE_ALGORITHM_LOGGING || true),
    algorunnerLogFileName: process.env.ALGORITHM_LOG_FILE_NAME || 'algorunner_0.log',
    baseLogsPath: path.join((process.env.BASE_LOGS_PATH || '/var/log/pods'), (process.env.POD_ID || ''))
};

config.timeouts = {
    stop: 10000, // timeout to stop the algorithm in ms
    stoppingIntervalCount: 20, // number of times an algorithm can report stopping
    inactive: formatter.parseInt(process.env.INACTIVE_WORKER_TIMEOUT_MS, 36000 * 1000),
    inactivePaused: formatter.parseInt(process.env.INACTIVE_PAUSED_WORKER_TIMEOUT_MS, 120 * 1000),
    algorithmDisconnected: formatter.parseInt(process.env.ALGORITHM_DISCONNECTED_TIMEOUT_MS, 120 * 1000)
};


module.exports = config;
