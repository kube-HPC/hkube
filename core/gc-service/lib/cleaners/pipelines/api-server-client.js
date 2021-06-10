const request = require('requestretry');

class ApiServerClient {
    constructor() {
        this.retrySettings = {
            maxAttempts: 5,
            retryDelay: 5000,
            retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        };
    }

    async init(config) {
        const { protocol, host, port, stopPath } = config.apiServer;
        this._stopUrl = `${protocol}://${host}:${port}/${stopPath}`;
    }

    async stop(options) {
        return request({
            method: 'POST',
            uri: this._stopUrl,
            body: {
                jobId: options.jobId,
                reason: options.reason
            },
            json: true,
            ...this.retrySettings
        });
    }
}

module.exports = new ApiServerClient();
