const request = require('requestretry');
const { generalConsts } = require('../consts');

class PipelineProducer {
    constructor() {
        this.retrySettings = {
            maxAttempts: 5,
            retryDelay: 5000,
            retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        };
    }

    async init(config) {
        const { protocol, host, port, storedPath, pipelinesPath } = config.apiServer;
        this._storedApiUrl = `${protocol}://${host}:${port}/${storedPath}`;
        this._pipelinesApiUrl = `${protocol}://${host}:${port}/${pipelinesPath}`;
    }

    async produce(trigger) {
        if (!trigger.name) {
            throw new Error('invalid name');
        }
        const tags = await this._getTags(trigger.jobId);
        return request({
            method: 'POST',
            uri: `${this._storedApiUrl}/${trigger.type}`,
            body: {
                name: trigger.name,
                parentJobId: trigger.jobId,
                userName: generalConsts.TRIGGER_USER_FOR_AUDIT,
                tags
            },
            json: true,
            ...this.retrySettings
        });
    }

    async _getTags(parentJobId) {
        const { body: parentPipeline } = await request({
            method: 'GET',
            uri: `${this._pipelinesApiUrl}/${parentJobId}`,
            json: true
        });
        return parentPipeline.tags;
    }
}

module.exports = new PipelineProducer();
