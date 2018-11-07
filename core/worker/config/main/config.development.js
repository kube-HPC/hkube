const path = require('path');
const config = {};
config.algorunnerLogging = {
    algorunnerLogFileName: process.env.ALGORITHM_LOG_FILE_NAME || 'algorunner_0.log',
    baseLogsPath: path.join((process.env.BASE_LOGS_PATH || '/var/log/pods'), (process.env.POD_ID || ''))
};

config.timeouts = {
    stop: 10000, // timeout to stop the algorithm in ms
    inactive: process.env.INACTIVE_WORKER_TIMEOUT_MS || (360 * 1000),
    inactivePaused: process.env.INACTIVE_PAUSED_WORKER_TIMEOUT_MS || (120 * 1000),
    algorithmDisconnected: process.env.ALGORITHM_DISCONNECTED_TIMEOUT_MS || (120 * 1000)
};

module.exports = config;
