const Logger = require('@hkube/logger');
const component = require('../../common/consts/componentNames.js').ALGORUNNER;
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
            log.warning('Algorunner loggin proxy not started.', { component });
            return;
        }
        const { algorunnerLogFileName, baseLogsPath } = options.algorunnerLogging;
        if (!algorunnerLogFileName || !baseLogsPath) {
            log.warning('Algorunner loggin proxy not started.', { component });
            return;
        }
        this._algorunnerLogFilePath = path.join(baseLogsPath, algorunnerLogFileName);
        log.info(`reading algorunner logs from host path ${this._algorunnerLogFilePath}`, { component });

        this._startWatch();
    }

    _startWatch() {
        if (!this._algorunnerLogFilePath) {
            return;
        }
        if (!fs.existsSync(this._algorunnerLogFilePath)) {
            log.warning(
                `log file ${this._algorunnerLogFilePath} does not exist. Trying again in ${DELAY} seconds.`,
                { component }
            );
            setTimeout(this._startWatch.bind(this), DELAY * 1000);
            return;
        }
        try {
            this._tail = new Tail(this._algorunnerLogFilePath);
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
                log.error(error, { component });
            });
        }
        catch (error) {
            log.warning(`Algorunner loggin proxy error: ${error}. Trying again in ${DELAY} seconds.`, { component });
            setTimeout(this._startWatch.bind(this), DELAY * 1000);
        }
    }
}

module.exports = new LoggingProxy();
