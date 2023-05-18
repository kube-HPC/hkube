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
            this._structuredPrefix = options.elasticSearch.structuredPrefix;
            log.info(`Initialized elasticSearch client with options ${JSON.stringify(this._client.options)}`, { component });
        }
        catch (error) {
            log.error(error.message, { component }, error);
        }
    }

    addComponentCriteria(nodeKind) {
        let search;
        const components = getSearchComponent(nodeKind).map(sc => `${this._structuredPrefix}meta.internal.component: "${sc}"`);
        if (components.length) {
            search = `(${components.join(' OR ')})`;
        }
        return search;
    }

    async getLogs({ taskId, nodeKind, podName, logMode, sort, limit, skip }) {
        const query = [];
        if (taskId) {
            query.push(`${this._structuredPrefix}meta.internal.taskId: "${taskId}"`);
        }
        if (podName) {
            query.push(`kubernetes.pod_name: "${podName}"`);
        }
        if (logMode === logModes.INTERNAL) {
            query.push(`${this._structuredPrefix}message: "${internalLogPrefix}*"`);
        }
        if (logMode === logModes.ALGORITHM) {
            query.push(`NOT ${this._structuredPrefix}message: "${internalLogPrefix}*"`);
        }
        if (nodeKind) {
            const searchComponent = this.addComponentCriteria(nodeKind);
            if (searchComponent) {
                query.push(searchComponent);
            }
        }

        const queryString = query.join(' AND ');

        const body = {
            size: limit,
            from: skip,
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
        const logs = await this._client.search({
            index: this._index,
            type: this._type,
            body
        });
        return logs.hits;
    }
}

module.exports = new EsLogs();
