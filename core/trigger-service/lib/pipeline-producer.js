const log = require('@hkube/logger').GetLogFromContainer();
const {componentName} = require('./consts/index');
const request = require('requestretry');
const {apiServer} = require('../consts/index');

class PipelineProducer {
    constructor() {
        this.config = null;
        this.retrySettings = {
            maxAttempts: 5,
            retryDelay: 5000,
            retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        };
    }
    async init(config) {
        this.config = config;
        this.apiUrl = `${this.config.apiServer.protocol}//${this.config.apiServer.host}:${this.apiServer.protocol.port}/${apiServer.suffix}`;
    }
    async produce(name, flowInput = []) {
        log.info(`try to serd pipeline with name ${name} to api server`, { component: componentName.PIPELINE_PRODUCER});
        request({
            method: 'POST',
            uri: this.apiUrl,
            body: {
                name,
                flowInput
            },
            json: true,
            ...this.retrySettings
        }).then(() => {
            log.info('pipeline sent to api server  ', { component: componentName.PIPELINE_PRODUCER});
        }).catch((err) => {
            log.error(`an error acuured or maxretiries was reached errorMessage:${err} `, { component: componentName.PIPELINE_PRODUCER});
        });
        
        return true;
    }
}


module.exports = new PipelineProducer();
