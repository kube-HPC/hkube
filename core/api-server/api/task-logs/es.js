const ElasticClient = require('@hkube/elastic-client');
const { logModes } = require('@hkube/consts');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../lib/consts/componentNames').LOGS;
const { getSearchComponent } = require('./searchComponents');
const { internalLogPrefix } = require('./consts');

class EsLogs {
    constructor() {
        this._client = null;
    }

    async init(options) {
        try {
            this._client = new ElasticClient({
                node: options.elasticSearch.url,
                enableLivenessCheck: false,
                keepAlive: false,
                livenessCheckInterval: -1,
                token: options.serviceAccount.token,
                tls: {
                    rejectUnauthorized: false
                },
                ssl: {
                    rejectUnauthorized: false
                }
            });
            this._type = options.elasticSearch.type;
            this._index = options.elasticSearch.index;
            this._structuredPrefixAtrributeName = options.elasticSearch.structuredPrefix;
            this._structuredPrefix = options.elasticSearch.structuredPrefix ? `${this._structuredPrefixAtrributeName}.` : '';
            log.info(`Initialized elasticSearch client with options ${JSON.stringify(this._client.options)}`, { component });
        }
        catch (error) {
            log.error(error.message, { component }, error);
        }
    }

    addComponentCriteria(nodeKind, containerNameList) {
        let search;
        const componentNames = getSearchComponent(nodeKind);
        if (containerNameList) {
            componentNames.push(...containerNameList);
        }
        const components = componentNames.map(sc => `${this._structuredPrefix}meta.internal.component: "${sc}"`);
        if (components.length) {
            search = `(${components.join(' OR ')})`;
        }
        return search;
    }

    async getLogs({ taskId, nodeKind, podName, logMode, sort, limit, skip, searchWord, taskTime, containerNameList }) {
        const query = [];
        if (podName) {
            query.push(`kubernetes.pod_name: "${podName}"`);
        }
        // Handle message structure
        switch (logMode) {
        case logModes.INTERNAL: // Source = System
            query.push(`${this._structuredPrefix}message: "${internalLogPrefix}*"`);
            break;
        case logModes.ALGORITHM || logModes.SIDECAR: // Source = Algorithm / SideCar
            query.push(`NOT ${this._structuredPrefix}message: "${internalLogPrefix}*"`);
            break;
        default:
            break;
        }
        // Handle components
        if (logMode === logModes.SIDECAR) { // In this case, it's possible to ask for 1 sideCar only.
            if (containerNameList.length === 0) {
                log.error('a sideCar Name is requried in containerNames when logMode is SIDECAR!', { component });
                return [];
            }
            const searchComponent = `${this._structuredPrefix}meta.internal.component: "${containerNameList[0]}"`;
            query.push(searchComponent);
        }
        else if (nodeKind) {
            const searchComponent = this.addComponentCriteria(nodeKind, containerNameList);
            if (searchComponent) {
                query.push(searchComponent);
            }
        }

        if (searchWord) {
            query.push(`${searchWord}*`);
        }

        let queryStringNoTaskId;
        if (logMode !== logModes.INTERNAL && logMode !== logModes.ALGORITHM) {
            queryStringNoTaskId = query.join(' AND ');
        }

        if (taskId) {
            query.push(`${this._structuredPrefix}meta.internal.taskId: "${taskId}"`);
        }

        const queryString = query.join(' AND ');

        const body = this._buildBody(limit, skip, sort, queryString);

        // add range date
        if (taskTime) {
            body.query.bool.must.push({
                range: {
                    '@timestamp': {
                        gte: taskTime,
                        lt: 'now/d'
                    }
                }
            });
        }

        const logs = await this._client.search({
            index: this._index,
            type: this._type,
            body
        });

        if (this._structuredPrefix) {
            logs.hits = logs.hits.map(line => ({
                ...line, ...line[this._structuredPrefixAtrributeName]
            }));
        }

        if (queryStringNoTaskId) {
            const bodyNoTaskId = this._buildBody(limit, skip, sort, queryStringNoTaskId);
            const logsNoTaskId = await this._client.search({
                index: this._index,
                type: this._type,
                body: bodyNoTaskId
            });
            if (this._structuredPrefix) {
                logsNoTaskId.hits = logsNoTaskId.hits.map(line => ({
                    ...line, ...line[this._structuredPrefixAtrributeName]
                }));
            }
            return [...logs.hits, ...logsNoTaskId.hits];
        }

        return logs.hits;
    }

    _buildBody(size, from, sort, queryString) {
        const body = {
            size,
            from,
            sort: [{ [`${this._structuredPrefix}meta.timestamp`]: { order: sort } }],
            _source: [`${this._structuredPrefix}message`, 'level', `${this._structuredPrefix}meta.timestamp`],
            query: {
                bool: {
                    must: [{
                        query_string: {
                            query: queryString
                        }
                    }]
                }
            }
        };
        return body;
    }
}

module.exports = new EsLogs();
