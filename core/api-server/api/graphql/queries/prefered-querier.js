const { default: axios } = require('axios');
const querystring = require('query-string');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../../lib/consts/componentNames').GRAPHQL_SERVER;
class PreferedQuerier {
    init(config) {
        const { protocol, host, port, prefix } = config.pipelineDriverQueueService;
        this._baseUrl = `${protocol}://${host}:${port}/${prefix}`;
        this._suffix = {
            prefered: '/preferred',
            managed: '/managed',
            count: '/count',
            aggregatedPreferedByTags: '/preferred/aggregation/tag',
            aggregatedPreferedByPipeline: '/preferred/aggregation/pipeline',
            aggregatedManagedByTags: '/managed/aggregation/tag',
            aggregatedManagedByPipeline: '/managed/aggregation/pipeline'
        };
    }

    getPreferedList(options) {
        return this._getRequest(this._baseUrl + this._suffix.prefered, options);
    }

    getManagedList(options) {
        return this._getRequest(this._baseUrl + this._suffix.managed, options);
    }

    getQueueCount() {
        return this._getRequest(this._baseUrl + this._suffix.count);
    }

    getAggregatedPreferedByTags(options) {
        return this._getRequest(this._baseUrl + this._suffix.aggregatedPreferedByTags, options);
    }

    getAggregatedPreferedByPipeline(options) {
        return this._getRequest(this._baseUrl + this._suffix.aggregatedPreferedByPipeline, options);
    }

    getAggregatedManagedByTags(options) {
        return this._getRequest(this._baseUrl + this._suffix.aggregatedManagedByTags, options);
    }

    getAggregatedManagedByPipeline(options) {
        return this._getRequest(this._baseUrl + this._suffix.aggregatedManagedByPipeline, options);
    }

    async _getRequest(url, options) {
        try {
            const { data } = await axios.get(url, { params: options });
            return data;
        }
        catch (error) {
            log.error(error.message, { component });
            return null;
        }
    }
}
module.exports = new PreferedQuerier();
