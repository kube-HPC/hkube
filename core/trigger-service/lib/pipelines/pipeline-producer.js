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
        const { protocol, host, port, path } = config.apiServer;
        this._apiUrl = `${protocol}://${host}:${port}/${path}`;
    }

    async produce(trigger) {
        if (!trigger.name) {
            throw new Error('invalid name');
        }
        return request({
            method: 'POST',
            uri: `${this._apiUrl}/${trigger.type}`,
            body: {
                name: trigger.name,
                parentJobId: trigger.jobId,
                userName: generalConsts.TRIGGER_USER_FOR_AUDIT
            },
            json: true,
            ...this.retrySettings
        });
    }
}

module.exports = new PipelineProducer();
