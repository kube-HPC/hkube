const log = require('@hkube/logger').GetLogFromContainer();
const { componentName } = require('../consts/index');
const request = require('requestretry');

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

    async produce(name, jobId) {
        log.info(`try to send pipeline ${name} to api server`, { component: componentName.PIPELINE_PRODUCER });
        request({
            method: 'POST',
            uri: this._apiUrl,
            body: {
                name,
                parentJobId: jobId
            },
            json: true,
            ...this.retrySettings
        }).then(() => {
            log.info(`pipeline ${name} sent to api server`, { component: componentName.PIPELINE_PRODUCER });
        }).catch((err) => {
            log.error(`pipeline ${name} failed to sent to api server error:${err} `, { component: componentName.PIPELINE_PRODUCER });
        });
    }
}


module.exports = new PipelineProducer();
