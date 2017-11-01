const request = require('requestretry');
const stateManager = require('lib/state/state-manager');
const Webhook = require('./web-hook');
const Logger = require('logger.rf');
const log = Logger.GetLogFromContainer();
const components = require('common/consts/componentNames');

class WebhooksHandler {

    init() {
        stateManager.on('job-result', (data) => {
            const webhook = new Webhook({
                webhookID: data.jobId,
                data: data.result
            });
            log.info(`job result event. trying to callback webhook ${data.webhook.resultHook}`, { component: components.MAIN });
            this._request(data.webhook.resultHook, webhook);
        })
    }

    _request(url, webhook) {
        request({
            method: 'POST',
            uri: url,
            body: webhook,
            json: true,
            maxAttempts: 1,
            retryDelay: 5000,
            retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        }).then((response) => {
            log.info(`webhook completed with status ${response.statusCode} ${response.statusMessage}`, { component: components.MAIN });
        }).catch((error) => {
            log.error(`webhook failed ${error.message}`, { component: components.MAIN });
        });
    }
}

module.exports = new WebhooksHandler();