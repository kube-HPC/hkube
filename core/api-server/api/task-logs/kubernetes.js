const KubernetesClient = require('@hkube/kubernetes-client').Client;
const { logModes, nodeKind: nodesKind } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const { nodeKind: nodeKinds } = require('@hkube/consts');
const component = require('../../lib/consts/componentNames').LOGS;
const { getSearchComponent } = require('./searchComponents');
const { formats, containers, sortOrder, internalLogPrefix } = require('./consts');

class KubernetesLogs {
    constructor() {
        this._client = null;
        this._formatMethods = new Map();
        this._formatMethods.set(formats.json, this._formatJson);
        this._formatMethods.set(formats.raw, this._formatRaw);
    }

    async init(options) {
        try {
            this._client = new KubernetesClient();
            await this._client.init(options.kubernetes);
            this.kubeVersion = await this._client.versions.getParsedVersion();
            log.info(`Initialized kubernetes client with version: ${this.kubeVersion.version} (${this.kubeVersion.gitVersion}), url: ${this._client._config.url}`, { component });
        }
        catch (error) {
            log.error(`Error initializing kubernetes. error: ${error.message}`, { component }, error);
        }
    }

    updateFormat(format) {
        this._formatMethod = this._formatMethods.get(format);
    }

    /* eslint-disable indent */
    getContainerName(kind) {
        switch (kind) {
            case containers.pipelineDriver:
            case nodeKinds.DataSource:
                return undefined;
            case nodesKind.Algorithm:
            case nodesKind.Debug:
            case nodesKind.Gateway:
            case containers.worker:
                return containers.worker;
            default:
                throw new Error(`invalid node kind ${kind}`);
        }
    }

    /**
     * Retrieves logs from a specific container or pod in a Kubernetes cluster.
     * Return value - if containerName is provided, logs are taken from a sidecar container, which has no special structure.
     * In this case, we return the logs as array of lines. Otherwise, logs are taken from the worker container.
     */
    async getLogs({ taskId, podName, nodeKind, logMode, pageNum, sort, limit, skip, containerName }) {
        let tailLines;
        if (sort === sortOrder.desc) {
            tailLines = limit;
        }

        const resolvedContainerName = containerName || this.getContainerName(nodeKind);
        const logsData = await this._client.logs.get({ podName, tailLines, containerName: resolvedContainerName });

        return this._formalizeData({ logsData, taskId, nodeKind, logMode, pageNum, sort, limit, skip, containerName });
    }

    _formalizeData({ logsData, taskId, nodeKind, logMode, pageNum, limit, skip, containerName }) {
        let logs = [];
        const logList = logsData.body.split('\n');
        logList.forEach((line) => {
            if (!line) {
                return;
            }
            const logData = containerName ? this._formatSideCarLog(line, containerName) : this._formatMethod(line, taskId, nodeKind); // if we have a container name, it`s a sidecar log.
            const valid = this._filter(logData, logMode);
            if (valid) {
                logs.push(logData);
            }
        });
        if (logs.length) {
            const pageNumber = pageNum || 1;
            logs = logs.slice(skip, pageNumber * limit);
        }
        return logs;
    }

    /**
     * Formats a log line from a sidecar container.
     *
     * @param {string} line - The log line to be formatted.
     * @param {string} containerName - The name of the sidecar container.
     * @returns {Object} - The formatted log data.
     * @property {number} timestamp - The timestamp of the log line.
     * @property {string} message - The formatted log message.
     * @property {string} level - The log level (always 'info' in this case, since level is unknown).
     */
    _formatSideCarLog(line, containerName) {
        return {
            timestamp: Date.now(),
            message: `K8S (Sidecar: ${containerName}): ${line}`,
            level: 'info'
        };
    }

    _filter(line, logMode) {
        if (!line?.message) {
            return false;
        }
        if (logMode === logModes.ALL) {
            return true;
        }
        const isInternalLog = line.message.startsWith(`${internalLogPrefix}`);
        if (logMode === logModes.INTERNAL && isInternalLog) {
            return true;
        }
        if (logMode === logModes.ALGORITHM && !isInternalLog) {
            return true;
        }
        return false;
    }

    _formatJson(str, task, nodeKind) {
        try {
            const line = JSON.parse(str);
            const { taskId, component: logComponent } = line.meta.internal;
            if (task) {
                if (task === taskId && getSearchComponent(nodeKind).includes(logComponent)) {
                    return line;
                }
            }
            else {
                return line;
            }
        }
        catch (error) {
            return null;
        }
        return null;
    }

    _formatRaw(line) {
        return { message: line };
    }

    async _getPods(labelSelector) {
        const res = await this._client.pods.get({ labelSelector });
        return res;
    }

    async _deletePods(podName) {
        const res = await this._client.pods.delete({ podName });
        return res;
    }

    async _getJobs(labelSelector) {
        const res = await this._client.jobs.get({ labelSelector });
        return res;
    }

    async _deleteJobs(jobName) {
        const res = await this._client.jobs.delete({ jobName });
        return res;
    }
}

module.exports = new KubernetesLogs();
