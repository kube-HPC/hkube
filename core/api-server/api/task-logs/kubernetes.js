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
     * Retrieves logs from worker container.
     * Return value - Returns an array of log objects, each containing a timestamp, level, and message, of the given containerNameList, if filtering by it.
     */
    async getLogs({ taskId, podName, nodeKind, logMode, pageNum, sort, limit, skip, containerNameList }) {
        let tailLines;
        if (sort === sortOrder.desc) {
            tailLines = limit;
        }
        // The worker container is logging all the other containers logs, by using logging-proxy. So we will need the worker logs.
        const containerName = this.getContainerName(nodeKind);
        const logsData = await this._client.logs.get({ podName, tailLines, containerName });

        return this._formalizeData({ logsData, taskId, nodeKind, logMode, pageNum, sort, limit, skip, containerNameList });
    }

    _formalizeData({ logsData, taskId, nodeKind, logMode, pageNum, limit, skip, containerNameList }) {
        let logs = [];
        const logList = logsData.body.split('\n');
        logList.forEach((line) => {
            if (!line) {
                return;
            }
            const logData = this._formatMethod(line, taskId, nodeKind, containerNameList);
            const valid = this._filter(logData, logMode, containerNameList);
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

    _filter(line, logMode, containerNameList) {
        if (!line?.message) {
            return false;
        }
        const { component: logComponent } = line.meta.internal;
        const isInternalLog = line.message.startsWith(`${internalLogPrefix}`);
        switch (logMode) {
            case logModes.ALL: // Source = All
                return true;
            case logModes.INTERNAL: // Source = System
                if (isInternalLog) {
                    return true;
                }
                break;
            case logModes.ALGORITHM: // Source = Algorithm
                if (!isInternalLog && logComponent === 'Algorunner') {
                    return true;
                }
                break;
            case logModes.SIDECAR: // Source = Sidecar
                if (!isInternalLog && containerNameList.includes(logComponent)) {
                    return true;
                }
                break;
            default:
                return false;
        }
        return false;
    }

    _formatJson(str, task, nodeKind, containerNameList) {
        try {
            const line = JSON.parse(str);
            const { taskId, component: logComponent } = line.meta.internal;
            if (task) {
                const resolvedSearchComponent = [...getSearchComponent(nodeKind), ...containerNameList];
                if (taskId) {
                    if (task === taskId && resolvedSearchComponent.includes(logComponent)) {
                        return line;
                    }
                }
                else if (resolvedSearchComponent.includes(logComponent)) { // case when sideCar container starts before jobID is given.
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
