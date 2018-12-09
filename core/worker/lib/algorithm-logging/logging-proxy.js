const path = require('path');
const fs = require('fs');
const Logger = require('@hkube/logger');
const { Tail } = require('tail');
const component = require('../consts').Components.ALGORUNNER;

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
        const { algorunnerLogFileName, baseLogsPath, disable } = options.algorunnerLogging;
        if (disable || !algorunnerLogFileName || !baseLogsPath) {
            log.warning('Algorunner logging proxy not started.', { component });
            return;
        }
        this._algorunnerLogFilePath = path.join(baseLogsPath, algorunnerLogFileName);
        log.info(`reading algorunner logs from host path ${this._algorunnerLogFilePath}`, { component });
        this._startWatch = this._startWatch.bind(this);
        this._startWatch();
    }

    _getLogMessage(rawLine) {
        try {
            const logParsed = JSON.parse(rawLine);
            if (logParsed.log) {
                try {
                    const internalLog = JSON.parse(logParsed.log);
                    const { log: logMessage, stream, ...parsedLogWithoutLogMessage } = internalLog;
                    return { logMessage, stream, parsedLogWithoutLogMessage };
                }
                catch (error) {
                    const { log: logMessage, stream, ...parsedLogWithoutLogMessage } = logParsed;
                    return { logMessage, stream, parsedLogWithoutLogMessage };
                }
            }
            else {
                const { log: logMessage, stream, ...parsedLogWithoutLogMessage } = logParsed;
                return { logMessage, stream, parsedLogWithoutLogMessage };
            }
        }
        catch (error) {
            return { logMessage: rawLine };
        }
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
                const { logMessage, stream, parsedLogWithoutLogMessage } = this._getLogMessage(line);
                if (stream === 'stderr') {
                    log.error(logMessage, { component, ...parsedLogWithoutLogMessage });
                }
                else {
                    log.info(logMessage, { component, ...parsedLogWithoutLogMessage });
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
