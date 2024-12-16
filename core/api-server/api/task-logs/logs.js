const log = require('@hkube/logger').GetLogFromContainer();
const fs = require('fs');
const orderBy = require('lodash.orderby');
const { logModes, podStatus } = require('@hkube/consts');
const elasticSearch = require('./es');
const kubernetes = require('./kubernetes');
const component = require('../../lib/consts/componentNames').LOGS;
const { sources, formats, containers, sortOrder, LOGS_LIMIT } = require('./consts');
class Logs {
    constructor() {
        this._sources = new Map();
        this._sources.set(sources.k8s, kubernetes);
        this._sources.set(sources.es, elasticSearch);
    }

    async init(options) {
        if (!options.serviceAccount.token) {
            const { tokenPath } = options.serviceAccount;
            if (fs.existsSync(tokenPath)) {
                const buffer = fs.readFileSync(tokenPath);
                // eslint-disable-next-line no-param-reassign
                options.serviceAccount.token = buffer.toString();
            }
        }
        elasticSearch.init(options);
        await kubernetes.init(options);
        this.updateSource(options.logsView.source);
        this.updateFormat(options.logsView.format);
    }

    get settings() {
        return {
            currentSource: this._logsSource,
            availableSources: Object.keys(sources)
        };
    }

    updateSource(source) {
        if (Object.keys(sources).includes(source)) {
            this._logsSource = source;
        }
    }

    updateFormat(format) {
        if (Object.keys(formats).includes(format)) {
            kubernetes.updateFormat(format);
        }
    }

    _getLogSource(source) {
        if (Object.keys(sources).includes(source)) {
            return this._sources.get(source);
        }
        throw new Error(`Unknown log source ${source}`);
    }

    /**
     * Fetches logs for a specified task or pod, including logs from sidecar containers if applicable.
     *
     * @async
     * @returns {Promise<Object>} A promise that resolves to an object containing:
     * - `logs`: An array of log entries with timestamps, levels, and messages.
     * - `podStatus`: The status of the pod (e.g., `NORMAL`, `ERROR`, `NOT_EXIST`, etc.).
     * @throws {Error} Throws an error if logs cannot be fetched from the specified source.
     */
    async getLogs({
        taskId,
        podName,
        nodeKind = containers.worker,
        source = sources.k8s,
        logMode = logModes.ALGORITHM,
        pageNum = 0,
        sort = sortOrder.desc,
        limit = LOGS_LIMIT,
        searchWord,
        taskTime
    }) {
        let logs = [];
        const logsData = {};
        try {
            let skip = 0;
            let sideCars = [];
            const pageNumber = parseInt(pageNum, 10);
            const sizeLimit = parseInt(limit, 10);
            if (pageNumber > 0) {
                skip = (pageNumber - 1) * sizeLimit;
            }

            logsData.podStatus = podStatus.NORMAL;

            try {
                const podData = await kubernetes._client.pods.get({ podName });
                const { status } = podData.body || {};
                if (status && status.containerStatuses && status.containerStatuses.length > 0) {
                    const currentAlgorunner = status.containerStatuses.find(x => x.name === containers.algorunner);
                    sideCars = status.containerStatuses.filter(x => (x.name !== containers.algorunner && x.name !== containers.worker));

                    const errorFound = sideCars.some(container => {
                        const retStatus = this._checkContainerState(container, true);
                        if (retStatus) {
                            logsData.podStatus = retStatus;
                            return retStatus === podStatus.ALGORUNNER.ERROR;
                        }
                        return false;
                    });

                    if (!errorFound && currentAlgorunner) {
                        const retStatus = this._checkContainerState(currentAlgorunner, false);
                        if (retStatus) {
                            logsData.podStatus = retStatus;
                        }
                    }
                }
                else {
                    logsData.podStatus = podStatus.NOT_EXIST;
                }
            }
            catch (e) {
                logsData.podStatus = podStatus.NOT_EXIST;
            }

            if (source === sources.k8s && logsData.podStatus === podStatus.NOT_EXIST) {
                logsData.logs = [];
            }
            else {
                const logSource = this._getLogSource(source);
                const args = {
                    taskId,
                    podName,
                    nodeKind,
                    logMode,
                    sort,
                    skip,
                    pageNum: pageNumber,
                    limit: sizeLimit,
                    searchWord,
                    taskTime
                };
                logs = await logSource.getLogs(args);
                logs = logs.map(this._format);
                if (sideCars.length > 0) {
                    const containerNames = sideCars.map(x => x.name);
                    const sideCarsLogs = await this._getSideCarLogs(containerNames, logSource, args);
                    logs.push(...sideCarsLogs);
                }
                logs = orderBy(logs, l => l.timestamp, sortOrder.desc);
                logsData.logs = logs;
            }
        }
        catch (e) {
            const error = `cannot read logs from ${source}, err: ${e.message}`;
            log.warning(error, { component });
            log.warning(e);
            logsData.logs = [{
                message: error
            }];
        }
        return logsData;
    }

    /**
     * Checks the state of a container and determines its status.
     *
     * @param {Object} container - The container object to check.
     * @param {Object} container.state - The state of the container, containing `terminated` and `waiting` properties.
     * @param {Object} [container.state.terminated] - The terminated state of the container, if it exists.
     * @param {string} [container.state.terminated.reason] - The reason for the termination, if available.
     * @param {Object} [container.state.waiting] - The waiting state of the container, if it exists.
     * @param {string} [container.state.waiting.reason] - The reason for the waiting state, if available.
     * @param {boolean} isSideCar - A flag indicating whether the container is a sidecar (`true`) or an algorunner (`false`).
     * @returns {string|null} Returns the status of the container:
     * - `podStatus.SIDECAR_ERROR` if the sidecar container terminated with an error.
     * - `podStatus.ALGORUNNER_ERROR` if the algorunner container terminated with an error.
     * - `podStatus.SIDECAR_NO_IMAGE` if the sidecar container is waiting due to an `ImagePullBackOff`.
     * - `podStatus.ALGORUNNER_NO_IMAGE` if the algorunner container is waiting due to an `ImagePullBackOff`.
     * - `null` if no relevant status is found.
     */
    _checkContainerState(container, isSideCar) {
        const { terminated, waiting } = container.state || {};
        if (terminated?.reason === 'Error') {
            return isSideCar ? podStatus.SIDECAR_ERROR : podStatus.ALGORUNNER_ERROR;
        }
        if (waiting?.reason === 'ImagePullBackOff') {
            return isSideCar ? podStatus.SIDECAR_NO_IMAGE : podStatus.ALGORUNNER_NO_IMAGE;
        }
        return null;
    }

    /**
     * Fetches and formats logs for a list of sidecar containers.
     *
     * @param {Array<string>} containerNames - List of sidecar`s container names to fetch logs for.
     * @param {Object} logSource - The log source object with a `getLogs` method for retrieving logs.
     * @param {Object} args - Common arguments used for log retrieval.
     * @returns {Promise<Array<Object>>} - A promise that resolves to a flattened array of formatted logs from all containers.
     * Each log entry contains:
     *   - `message` (string): The formatted log message, prefixed with the container name.
     *   - `level` (string): The log level (e.g., 'info', 'error').
     *   - `timestamp` (number): The timestamp of the log.
     */
    async _getSideCarLogs(containerNames, logSource, args) {
        const logPromises = containerNames.map(async (containerName) => {
            const currArgs = { ...args, containerName };
            try {
                let currLogs = await logSource.getLogs(currArgs);
                currLogs = currLogs.map(logLine => {
                    const formattedLog = this._format(logLine);
                    formattedLog.message = `K8S (Sidecar: ${containerName}): ${formattedLog.message}`;
                    return formattedLog;
                });
                return currLogs;
            }
            catch (error) {
                const errorLog = [{
                    message: `Error fetching logs for ${containerName}: ${error.message || error || ''}`,
                    level: 'error',
                    timestamp: Date.now()
                }];
                return errorLog;
            }
        });
        return Promise.all(logPromises).then(results => results.flat());
    }

    _format(line) {
        return {
            timestamp: line.meta?.timestamp,
            level: line.level,
            message: line.message
        };
    }
}

module.exports = new Logs();
