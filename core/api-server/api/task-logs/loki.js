const axios = require('axios');
const { logModes } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../lib/consts/componentNames').LOGS;
const { getSearchComponent } = require('./searchComponents');
const { internalLogPrefix, sortOrder } = require('./consts');

class LokiLogs {
    constructor() {
        this._client = null;
        this._options = null;
    }

    async init(options) {
        try {
            const lokiOptions = options.loki || {};
            const baseURL = (lokiOptions.baseUrl || lokiOptions.url || '').replace(/\/$/, '');
            if (!baseURL) {
                log.warning('Loki baseUrl is empty; Loki logs source will fail if selected', { component });
            }

            const headers = { ...(lokiOptions.headers || {}) };

            const useServiceAccountToken = lokiOptions.useServiceAccountToken !== false;
            if (!headers.Authorization && useServiceAccountToken && options.serviceAccount?.token) {
                headers.Authorization = `Bearer ${options.serviceAccount.token}`;
            }

            if (lokiOptions.tenantId && !headers['X-Scope-OrgID']) {
                headers['X-Scope-OrgID'] = lokiOptions.tenantId;
            }

            this._client = axios.create({
                baseURL,
                timeout: lokiOptions.timeout || 30000,
                headers
            });

            this._options = {
                ...lokiOptions,
                namespace: lokiOptions.namespace || options.kubernetes?.namespace,
                lookbackMs: lokiOptions.lookbackMs || 24 * 60 * 60 * 1000,
                labels: {
                    namespace: 'kubernetes_namespace_name',
                    pod: 'kubernetes_pod_name',
                    container: 'kubernetes_container_name',
                    stream: 'stream',
                    ...(lokiOptions.labels || {})
                },
                filters: {
                    taskIdContains: lokiOptions.filters?.taskIdContains || '"taskId":"{taskId}"',
                    componentContains: lokiOptions.filters?.componentContains || '"component":"{component}"'
                }
            };

            const safeOptions = { ...this._options };
            delete safeOptions.headers;
            log.info(`Initialized loki client with options ${JSON.stringify(safeOptions)}`, { component });
        }
        catch (error) {
            log.error(`Error initializing loki. error: ${error.message}`, { component }, error);
        }
    }

    _toNs(dateOrMs) {
        const ms = typeof dateOrMs === 'number' ? dateOrMs : new Date(dateOrMs).getTime();
        return `${ms}000000`;
    }

    _escapeLabelValue(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    _escapeRegex(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    _buildSelector({ podName, streamValue, containerName } = {}) {
        const labels = [];
        const { labels: labelKeys, namespace } = this._options;

        if (labelKeys.namespace && namespace) {
            labels.push(`${labelKeys.namespace}="${this._escapeLabelValue(namespace)}"`);
        }
        if (labelKeys.pod && podName) {
            labels.push(`${labelKeys.pod}="${this._escapeLabelValue(podName)}"`);
        }
        if (labelKeys.container && containerName) {
            labels.push(`${labelKeys.container}="${this._escapeLabelValue(containerName)}"`);
        }
        if (labelKeys.stream && streamValue) {
            labels.push(`${labelKeys.stream}="${this._escapeLabelValue(streamValue)}"`);
        }

        return `{${labels.join(',')}}`;
    }

    _applyContainsFilter(str, template, value) {
        if (!value) {
            return str;
        }
        const needle = template.replace('{taskId}', value).replace('{component}', value);
        return `${str} |= ${JSON.stringify(needle)}`;
    }

    _buildLogQL({ taskId, nodeKind, podName, logMode, searchWord, containerNameList, withTaskId = true, stdoutOnly = false }) {
        const { filters } = this._options;

        // Base selector - keep it minimal and do filtering in pipeline.
        const streamValue = stdoutOnly ? (this._options.stdoutStreamValue || 'stdout') : undefined;
        const selector = this._buildSelector({ podName, streamValue });
        let query = selector;

        // Message structure filters
        switch (logMode) {
        case logModes.INTERNAL:
            query = `${query} |= ${JSON.stringify(internalLogPrefix)}`;
            break;
        case logModes.ALGORITHM:
        case logModes.SIDECAR:
            query = `${query} |!= ${JSON.stringify(internalLogPrefix)}`;
            break;
        default:
            break;
        }

        // Component filters (best-effort; relies on logs containing a JSON field named "component")
        if (logMode === logModes.SIDECAR) {
            if (!containerNameList || containerNameList.length === 0) {
                log.error('a sideCar Name is required in containerNames when logMode is SIDECAR!', { component });
                return null;
            }
            query = this._applyContainsFilter(query, filters.componentContains, containerNameList[0]);
        }
        else if (nodeKind) {
            const componentNames = getSearchComponent(nodeKind);
            if (containerNameList?.length) {
                componentNames.push(...containerNameList);
            }
            if (componentNames.length) {
                // Prefer regex OR: match any component name in one pipeline stage.
                // Assumes log lines contain a JSON field "component":"<name>".
                const escaped = componentNames.map(c => this._escapeRegex(c)).join('|');
                const componentRegex = `"component":"(${escaped})"`;
                query = `${query} |~ ${JSON.stringify(componentRegex)}`;
            }
        }

        if (searchWord) {
            query = `${query} |= ${JSON.stringify(searchWord)}`;
        }

        if (withTaskId && taskId) {
            query = this._applyContainsFilter(query, filters.taskIdContains, taskId);
        }

        // Optional: if your log lines are JSON and you want to format output, you can extend with `| json`.
        // We intentionally keep it substring-based for compatibility across different Loki ingestion pipelines.

        return query;
    }

    async _queryRange({ query, startNs, endNs, limit, direction }) {
        const prefix = (this._options.pathPrefix || '').replace(/\/$/, '');
        const url = `${prefix}/query_range`;

        const { data } = await this._client.get(url, {
            params: {
                query,
                start: startNs,
                end: endNs,
                limit,
                direction
            }
        });

        if (!data?.data?.result) {
            return [];
        }

        const entries = (data.data.result || []).reduce((acc, stream) => {
            const values = stream.values || [];
            return acc.concat(values.map(([tsNs, line]) => ({ tsNs, line })));
        }, []);

        // Loki returns strings for timestamps
        entries.sort((a, b) => {
            if (direction === 'forward') {
                return a.tsNs.localeCompare(b.tsNs);
            }
            return b.tsNs.localeCompare(a.tsNs);
        });

        return entries;
    }

    _mapLine({ tsNs, line }) {
        const iso = new Date(Number(tsNs) / 1e6).toISOString();
        if (this._options.parseJson !== false) {
            try {
                const parsed = JSON.parse(line);
                if (parsed && typeof parsed === 'object') {
                    if (!parsed.meta) {
                        parsed.meta = {};
                    }
                    if (!parsed.meta.timestamp) {
                        parsed.meta.timestamp = iso;
                    }
                    if (!parsed.message && typeof parsed.msg === 'string') {
                        parsed.message = parsed.msg;
                    }
                    return parsed;
                }
            }
            catch (e) {
                // fall through to raw
            }
        }
        return {
            message: line,
            meta: {
                timestamp: iso,
                internal: {
                    component: 'Loki'
                }
            }
        };
    }

    async getLogs({ taskId, nodeKind, podName, logMode, sort, limit, skip, searchWord, taskTime, containerNameList }) {
        if (!this._client) {
            throw new Error('Loki client is not initialized');
        }

        const direction = sort === sortOrder.asc ? 'forward' : 'backward';
        const nowMs = Date.now();
        const startMs = taskTime ? new Date(taskTime).getTime() : (nowMs - (this._options.lookbackMs || 0));

        const startNs = this._toNs(startMs);
        const endNs = this._toNs(nowMs);

        const requested = (Number(skip) || 0) + (Number(limit) || 0);
        const effectiveLimit = requested > 0 ? requested : (Number(limit) || 500);

        const query = this._buildLogQL({ taskId, nodeKind, podName, logMode, searchWord, containerNameList, withTaskId: true, stdoutOnly: false });
        if (!query) {
            return [];
        }

        const entries = await this._queryRange({ query, startNs, endNs, limit: effectiveLimit, direction });
        let logs = entries.map(e => this._mapLine(e));

        // Similar to ES behavior for sidecar/all: also try stdout logs without taskId filter
        let logsNoTaskId = [];
        if (logMode !== logModes.INTERNAL && logMode !== logModes.ALGORITHM && taskId) {
            const queryNoTaskId = this._buildLogQL({ taskId, nodeKind, podName, logMode, searchWord, containerNameList, withTaskId: false, stdoutOnly: true });
            if (queryNoTaskId) {
                const entriesNoTaskId = await this._queryRange({ query: queryNoTaskId, startNs, endNs, limit: effectiveLimit, direction });
                logsNoTaskId = entriesNoTaskId.map(e => this._mapLine(e));
            }
        }

        logs = [...logs, ...logsNoTaskId];

        const start = Number(skip) || 0;
        const end = start + (Number(limit) || logs.length);
        return logs.slice(start, end);
    }
}

module.exports = new LokiLogs();
