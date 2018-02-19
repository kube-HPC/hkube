const path = require('path');
const config = {};
config.algorunnerLogging = {
    algorunnerLogFileName: process.env.ALGORITHM_LOG_FILE_NAME || 'algorunner_0.log',
    baseLogsPath: path.join((process.env.BASE_LOGS_PATH || '/var/log/pods'), (process.env.POD_ID || ''))
};
module.exports = config;
