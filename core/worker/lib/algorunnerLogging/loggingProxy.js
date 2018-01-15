const Logger = require('@hkube/logger');
const components = require('../../common/consts/componentNames.js');
const path = require('path');
const fs = require('fs');
const { Tail } = require('tail');
const stateManager = require('../states/stateManager');
const objectPath = require('object-path');
const DELAY = 2;
let log;

class LoggingProxy {
    async init(options) {
        log = Logger.GetLogFromContainer();
        const loggingOptions = (options && options.algorunnerLogging);
        if (!loggingOptions) {
            log.warning('Algorunner loggin proxy not started.', { component: components.ALGORUNNER });
            return;
        }
        const { algorunnerLogFileName, baseLogsPath } = options.algorunnerLogging;
        if (!algorunnerLogFileName || !baseLogsPath) {
            log.warning('Algorunner loggin proxy not started.', { component: components.ALGORUNNER });
            return;
        }
        this._algorunnerLogFilePath = path.join(baseLogsPath, algorunnerLogFileName);
        log.info(`reading algorunner logs from host path ${this._algorunnerLogFilePath}`, { component: components.ALGORUNNER });

        this._startWatch();
    }

    _startWatch() {
        if (!this._algorunnerLogFilePath) {
            return;
        }
        if (!fs.existsSync(this._algorunnerLogFilePath)) {
            log.warning(
                `log file ${this._algorunnerLogFilePath} does not exist. Trying again in ${DELAY} seconds.`,
                { component: components.ALGORUNNER }
            );
            setTimeout(this._startWatch.bind(this), DELAY * 1000);
            return;
        }
        try {
            this._tail = new Tail(this._algorunnerLogFilePath);
            this._tail.on('line', (line) => {
                const jobID = objectPath.get(stateManager.job, 'data.jobID');
                const taskID = objectPath.get(stateManager.job, 'data.taskID');
                try {
                    const logParsed = JSON.parse(line);

                    const logMessage = logParsed.log;
                    log.info(logMessage, { component: components.ALGORUNNER, jobID, taskID });
                }
                catch (error) {
                    log.info(line, { component: components.ALGORUNNER, jobID, taskID });
                }
            });
            this._tail.on('error', (error) => {
                log.error(error, { component: components.ALGORUNNER });
            });
        }
        catch (error) {
            log.warning(`Algorunner loggin proxy error: ${error}. Trying again in ${DELAY} seconds.`, { component: components.ALGORUNNER });
            setTimeout(this._startWatch.bind(this), DELAY * 1000);
        }
    }
}

module.exports = new LoggingProxy();
