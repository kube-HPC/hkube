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
                host: options.elasticSearch.url,
                enableLivenessCheck: false,
                keepAlive: false,
                livenessCheckInterval: -1,
                token: options.token
            });
            this._type = options.elasticSearch.type;
            this._index = options.elasticSearch.index;
            log.info(`Initialized elasticSearch client with options ${JSON.stringify(this._client.options)}`, { component });
        }
        catch (error) {
            log.error(error.message, { component }, error);
        }
    }

    addComponentCriteria(nodeKind) {
        let search;
        const components = getSearchComponent(nodeKind).map(sc => `meta.internal.component: "${sc}"`);
        if (components.length) {
            search = `(${components.join(' OR ')})`;
        }
        return search;
    }

    async getLogs({ taskId, nodeKind, podName, logMode, sort, limit, skip }) {
        const query = [];
        if (taskId) {
            query.push(`meta.internal.taskId: "${taskId}"`);
        }
        if (podName) {
            query.push(`kubernetes.pod_name: "${podName}"`);
        }
        if (logMode === logModes.INTERNAL) {
            query.push(`message: "${internalLogPrefix}*"`);
        }
        if (logMode === logModes.ALGORITHM) {
            query.push(`NOT message: "${internalLogPrefix}*"`);
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
            sort: [{
                'meta.timestamp': {
                    order: sort
                }
            }],
            _source: ['message', 'level', 'meta.timestamp'],
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
