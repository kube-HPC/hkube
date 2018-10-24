const Logger = require('@hkube/logger');
const component = require('../../lib/consts/componentNames.js').ALGORUNNER;
const path = require('path');
const fs = require('fs');
const { Tail } = require('tail');
const DELAY = 2;
let log;

class LoggingProxy {
    async init(options) {
        log = Logger.GetLogFromContainer();
        const loggingOptions = (options && options.algorunnerLogging);
        if (!loggingOptions) {
            log.warning('Algorunner logging proxy not started.', { component });
            return;
        }
        const { algorunnerLogFileName, baseLogsPath } = options.algorunnerLogging;
        if (!algorunnerLogFileName || !baseLogsPath) {
            log.warning('Algorunner logging proxy not started.', { component });
            return;
        }
        this._algorunnerLogFilePath = path.join(baseLogsPath, algorunnerLogFileName);
        log.info(`reading algorunner logs from host path ${this._algorunnerLogFilePath}`, { component });
        this._startWatch = this._startWatch.bind(this);
        this._startWatch();
    }

    _startWatch() {
        if (!this._algorunnerLogFilePath) {
            return;
        }
        if (!fs.existsSync(this._algorunnerLogFilePath)) {
            log.throttle.warning(`log file ${this._algorunnerLogFilePath} does not exist. Trying again in ${DELAY} seconds.`, { component });
            setTimeout(this._startWatch, DELAY * 1000);
            return;
        }
        try {
            this._tail = new Tail(this._algorunnerLogFilePath, { fromBeginning: true });
            this._tail.on('line', (line) => {
                try {
                    const logParsed = JSON.parse(line);
                    const logMessage = logParsed.log;
                    const { stream } = logParsed;

                    if (stream === 'stderr') {
                        log.error(logMessage, { component });
                    }
                    else {
                        log.info(logMessage, { component });
                    }
                }
                catch (error) {
                    log.info(line, { component });
                }
            });
            this._tail.on('error', (error) => {
                log.throttle.error(error.message, { component });
            });
        }
        catch (error) {
            log.throttle.warning(`Algorunner logging proxy error: ${error.message}. Trying again in ${DELAY} seconds.`, { component });
            setTimeout(this._startWatch, DELAY * 1000);
        }
    }
}

module.exports = new LoggingProxy();
