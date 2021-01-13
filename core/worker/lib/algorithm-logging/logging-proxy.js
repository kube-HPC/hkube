const path = require('path');
const fs = require('fs');
const Logger = require('@hkube/logger');
const { Tail } = require('tail');
const component = require('../consts').Components.ALGORUNNER;
const kubernetes = require('../helpers/kubernetes');

const DELAY = 2;
let log;

class LoggingProxy {
    async init(options) {
        log = Logger.GetLogFromContainer();
        if (!options?.algorunnerLogging) {
            log.warning('Algorunner logging proxy not started.', { component });
            return;
        }
        const { algorunnerLogFileName, baseLogsPath, disable } = this._createLogPath({
            ...options.algorunnerLogging,
            podId: options.kubernetes.podId,
            podName: options.kubernetes.pod_name
        });
        if (disable || !algorunnerLogFileName || !baseLogsPath) {
            log.warning('Algorunner logging proxy not started.', { component });
            return;
        }

        this._algorunnerLogFilePath = path.join(baseLogsPath, algorunnerLogFileName);
        log.info(`reading algorunner logs from host path ${this._algorunnerLogFilePath}`, { component });
        this._startWatch = this._startWatch.bind(this);
        this._startWatch();
    }

    _createLogPath({ algorunnerLogFileName, baseLogsPath, disable, podId, podName }) {
        if (disable) {
            return { disable };
        }
        if (algorunnerLogFileName && baseLogsPath) {
            return { algorunnerLogFileName, baseLogsPath };
        }
        const kubeVersion = kubernetes.kubeVersion || {};
        const namespace = kubernetes.namespace || 'default';
        if (kubeVersion.major > 1 || (kubeVersion.major === 1 && kubeVersion.minor >= 14)) {
            // logs are in /var/log/pods/default_podName_podid/container_name/0.log

            return {
                algorunnerLogFileName: '0.log',
                baseLogsPath: `/var/log/pods/${namespace}_${podName}_${podId}/algorunner`
            };
        }
        if (kubeVersion.major === 1 && kubeVersion.minor >= 12) {
            // logs are in /var/log/pods/podid/container_name/0.log

            return {
                algorunnerLogFileName: '0.log',
                baseLogsPath: `/var/log/pods/${podId}/algorunner`
            };
        }
        // logs are in /var/log/pods/podid/container_name_0.log
        return {
            algorunnerLogFileName: 'algorunner_0.log',
            baseLogsPath: `/var/log/pods/${podId}`
        };
    }

    _getLogMessage(rawLine) {
        let stream;
        let internalLog;
        let logMessage = rawLine;
        const logParsed = this._jsonTryParse(rawLine);

        if (logParsed?.log) {
            const internalParsed = this._jsonTryParse(logParsed.log);
            let logObject = logParsed;
            if (internalParsed?.log) {
                logObject = internalParsed;
            }
            const { log: logStr, stream: streamLog, ...rest } = logObject;
            logMessage = logStr;
            stream = streamLog;
            internalLog = rest;
        }
        return { logMessage, stream, internalLog };
    }

    _jsonTryParse(str) {
        let result;
        try {
            if (typeof str === 'string') {
                result = JSON.parse(str);
                return result;
            }
            return str;
        }
        catch (error) {
            result = str;
        }
        return result;
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
                const { logMessage, stream, internalLog } = this._getLogMessage(line);
                if (stream === 'stderr') {
                    log.info(logMessage, { component, ...internalLog });
                }
                else {
                    log.info(logMessage, { component, ...internalLog });
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
