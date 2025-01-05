const path = require('path');
const fs = require('fs');
const Logger = require('@hkube/logger');
const { Tail } = require('tail');
const algorunnerComponent = require('../consts').Components.ALGORUNNER;
const kubernetes = require('../helpers/kubernetes');

const DELAY = 2;
const criLogRegex = /^(?<time>.+) (?<stream>stdout|stderr) [^ ]* (?<log>.*)$/;
let log;
const ALGORITHM_CONTAINER = 'algorunner';
const WORKER_CONTAINER = 'worker';

class LoggingProxy {
    /**
     * Initializes the logging proxy by setting up the log file paths for Algorunner and sideCar containers.
     *
     * This method first checks if the `algorunnerLogging` option is provided. If not, it logs a warning and returns.
     * Then, it initializes the log file path for Algorunner using `_initAlgorunnerLogFilePath`. If the initialization fails, it returns early.
     * After that, it initializes the log file paths for sidecar containers using `_initSideCarLogFilePath`. If the initialization fails, it returns early.
     * If both initializations succeed, it binds the `_startWatch` method to the current context and starts the log file watch process.
     *
     * @param {Object} options - The options for configuring the logging proxy.
     * @param {Object} options.algorunnerLogging - The configuration for Algorunner logging.
     * @param {Object} options.kubernetes - The Kubernetes-related configuration.
     * @param {string} options.kubernetes.podId - The ID of the Kubernetes pod.
     * @param {string} options.kubernetes.pod_name - The name of the Kubernetes pod.
     *
     * @returns {Promise<void>} - This method returns a promise that resolves when the initialization is complete.
     *                             If logging proxy initialization fails at any point, it returns early without proceeding further.
     */
    async init(options) {
        log = Logger.GetLogFromContainer();
        if (!options?.algorunnerLogging) {
            log.warning('Logging proxy not started.', { component: algorunnerComponent });
            return;
        }
        if (await this._initAlgorunnerLogFilePath(options)) return; // true if failed
        if (await this._initSideCarLogFilePath(options)) return; // true if failed
        this._startWatch = this._startWatch.bind(this);
        this._startWatch();
    }

    /**
     * Initializes the log file path for the Algorunner container.
     *
     * This method generates the log file path for the Algorunner container using the provided options.
     * If logging is disabled or the log file name or base log path is missing, a warning is logged and the method returns `true`.
     * Otherwise, the log file path is stored and a message indicating the log path is logged.
     *
     * @param {Object} options - The options for configuring the log path.
     * @param {Object} options.algorunnerLogging - The logging configuration for Algorunner.
     * @param {Object} options.kubernetes - The Kubernetes-related configuration.
     * @param {string} options.kubernetes.podId - The ID of the Kubernetes pod.
     * @param {string} options.kubernetes.pod_name - The name of the Kubernetes pod.
     *
     * @returns {Promise<boolean>} - Returns `true` if the logging proxy is not started due to missing or invalid configuration, otherwise `false`.
     */
    async _initAlgorunnerLogFilePath(options) {
        const { logFileName, baseLogsPath, disable } = this._createLogPath({
            ...options.algorunnerLogging,
            podId: options.kubernetes.podId,
            podName: options.kubernetes.pod_name,
            containerName: ALGORITHM_CONTAINER
        });
        if (disable || !logFileName || !baseLogsPath) {
            log.warning('Algorunner logging proxy not started.', { component: algorunnerComponent });
            return true;
        }

        this._algorunnerLogFilePath = path.join(baseLogsPath, logFileName);
        log.info(`reading algorunner logs from host path ${this._algorunnerLogFilePath}`, { component: algorunnerComponent });
        return false;
    }

    /**
     * Initializes the log file paths for the sidecar containers in the pod.
     *
     * This method retrieves the sideCars container names, generates the log file path for each container,
     * and stores an object containing the log path and the container name.
     * If logging is disabled or the log file name or base log path is missing for any container, a warning is logged,
     * and the method returns `true` immediately.
     * Otherwise, the log file path for each sidecar container is stored, and a message indicating the log path is logged.
     *
     * @param {Object} options - The options for configuring the log paths.
     * @param {Object} options.algorunnerLogging - The logging configuration for Algorunner.
     * @param {Object} options.kubernetes - The Kubernetes-related configuration.
     * @param {string} options.kubernetes.podId - The ID of the Kubernetes pod.
     * @param {string} options.kubernetes.pod_name - The name of the Kubernetes pod.
     *
     * @returns {Promise<boolean>} - Returns `true` if any container logging proxy is not started, otherwise `false`.
     */
    async _initSideCarLogFilePath(options) {
        const sideCars = (await kubernetes.getContainerNamesForPod(options.kubernetes.pod_name))
            .filter(name => name !== ALGORITHM_CONTAINER && name !== WORKER_CONTAINER);
        this._sideCarLogFilePath = new Array(sideCars.length);

        const failed = sideCars.some((carName, index) => {
            const { logFileName, baseLogsPath, disable } = this._createLogPath({
                ...options.algorunnerLogging,
                podId: options.kubernetes.podId,
                podName: options.kubernetes.pod_name,
                containerName: carName
            });
            if (disable || !logFileName || !baseLogsPath) {
                // log.warning(`${carName} logging proxy not started.`, { carName });
                log.warning(`${carName} logging proxy not started.`, { carName });
                return true;
            }
            this._sideCarLogFilePath[index] = { path: path.join(baseLogsPath, logFileName), carName };
            log.info(`reading ${carName} logs from host path ${this._sideCarLogFilePath[index].path}`, { carName });
            return false;
        });
        return failed;
    }

    /**
     * Creates the log file path for a container based on the provided parameters.
     *
     * This method generates the log file path for a container, either for the Algorunner container or sidecar containers,
     * depending on the provided `containerName`. If the logging is disabled or required information is missing,
     * it returns an object indicating that the logging should be disabled.
     *
     * The log path is created based on the Kubernetes version and the container name.
     * For Kubernetes versions >= 1.14, the log paths are constructed using the pod's namespace, pod name, and pod ID.
     * For older versions, the log paths are constructed differently.
     *
     * @param {Object} options - The options for configuring the log path.
     * @param {string} options.algorunnerLogFileName - The log file name for the Algorunner container.
     * @param {string} options.baseLogsPath - The base directory for log files.
     * @param {boolean} options.disable - Indicates whether logging is disabled.
     * @param {string} options.podId - The ID of the Kubernetes pod.
     * @param {string} options.podName - The name of the Kubernetes pod.
     * @param {string} options.containerName - The name of the container (e.g., "algorunner", "sidecar").
     *
     * @returns {Object} - Returns an object containing the `logFileName` and `baseLogsPath` if logging is enabled,
     * or an object with `disable` if logging is disabled. The structure of the returned object varies
     * based on the Kubernetes version and container name.
     */
    _createLogPath({ algorunnerLogFileName, baseLogsPath, disable, podId, podName, containerName }) {
        if (disable) {
            return { disable };
        }
        if (algorunnerLogFileName && baseLogsPath && containerName === ALGORITHM_CONTAINER) {
            return { algorunnerLogFileName, baseLogsPath };
        }
        const kubeVersion = kubernetes.kubeVersion || {};
        const namespace = kubernetes.namespace || 'default';
        if (kubeVersion.major > 1 || (kubeVersion.major === 1 && kubeVersion.minor >= 14)) {
            // logs are in /var/log/pods/default_podName_podid/container_name/0.log

            return {
                logFileName: '0.log',
                baseLogsPath: `/var/log/pods/${namespace}_${podName}_${podId}/${containerName}`
            };
        }
        if (kubeVersion.major === 1 && kubeVersion.minor >= 12) {
            // logs are in /var/log/pods/podid/container_name/0.log

            return {
                logFileName: '0.log',
                baseLogsPath: `/var/log/pods/${podId}/${containerName}`
            };
        }
        // logs are in /var/log/pods/podid/container_name_0.log
        return {
            logFileName: `${containerName}_0.log`,
            baseLogsPath: `/var/log/pods/${podId}`
        };
    }

    _getLogMessage(rawLine) {
        let stream;
        let internalLog;
        let logMessage = rawLine;
        const match = criLogRegex.exec(logMessage);

        if ((match) !== null) {
            const { stream: _stream, log: _log } = match.groups;
            stream = _stream;
            logMessage = _log;
        }

        const logParsed = this._jsonTryParse(logMessage);

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

    /**
     * Starts watching the Algorunner and sidecar log files.
     *
     * @returns {void} - This method does not return any value. It simply starts the log monitoring process.
     */
    _startWatch() {
        this._startComponentWatch(this._algorunnerLogFilePath, algorunnerComponent);
        this._sideCarLogFilePath?.forEach((sidecar) => {
            this._startComponentWatch(sidecar.path, sidecar.carName);
        });
    }

    /**
     * Starts watching a specific log file for new log lines.
     *
     * This method checks if the log file path is valid and exists. If the file exists, it begins monitoring it
     * for new lines. If the log file doesn't exist, it will retry after a specified delay.
     *
     * @param {string} logFilePath - The path of the log file to be monitored.
     * @param {string} component - The name of the component associated with this log file.
     *
     * @returns {void} - This method does not return any value. It starts the log monitoring process for the given log file.
     */
    _startComponentWatch(logFilePath, component) {
        if (!logFilePath) return;
        if (!fs.existsSync(logFilePath)) {
            log.throttle.warning(`Log file ${logFilePath} does not exist. Trying again it ${DELAY} seconds.`, { component });
            setTimeout(() => this._startComponentWatch(logFilePath, component), DELAY * 1000);
            return;
        }
        try {
            if (component !== algorunnerComponent) {
                fs.readFile(logFilePath, 'utf8', (err, data) => {
                    if (err) {
                        log.error(`Error reading initial file logs: ${err.message}`, { component });
                    }
                    else {
                        const lines = data.split('\n');
                        lines.forEach(line => {
                            if (line.trim()) {
                                this._handleLogMessage(line, component);
                            }
                        });
                    }
                });
            }
            const tail = new Tail(logFilePath, { fromBeginning: true });
            tail.on('line', (line) => {
                this._handleLogMessage(line, component);
            });
            tail.on('error', (error) => {
                log.throttle.error(error.message, { component });
            });
        }
        catch (error) {
            log.throttle.warning(`Logging proxy error: ${error.message}. Trying again in ${DELAY} seconds.`, { component });
            setTimeout(() => this._startComponentWatch(logFilePath, component), DELAY * 1000);
        }
    }

    /**
     * Handles a log message by parsing it and logging it based on the stream type and component.
     *
     * This method processes the raw log message to determine whether it belongs to stdout or stderr
     * and logs it with the appropriate based on the component (Algorunner or sideCar name)
     *
     * @param {string} line - The raw log line to process.
     * @param {string} component - The name of the component generating the log (e.g., 'Algorunner', sideCar name).
     * @param {string} [prefix=''] - An optional string to prefix the log message, typically used for sidecar identification (default is an empty string).
     *
     * @returns {void} - This method does not return a value. It logs the processed message based on the stream type.
     */
    _handleLogMessage(line, component) {
        const { logMessage, stream, internalLog } = this._getLogMessage(line);
        if (stream === 'stderr') {
            log.error(`${logMessage}`, { component, ...internalLog });
        }
        else {
            log.info(`${logMessage}`, { component, ...internalLog });
        }
    }
}

module.exports = new LoggingProxy();
