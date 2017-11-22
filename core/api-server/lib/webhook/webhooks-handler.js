const request = require('requestretry');
const stateManager = require('lib/state/state-manager');
const Webhook = require('./web-hook');
const Logger = require('logger.hkube');
const log = Logger.GetLogFromContainer();
const components = require('common/consts/componentNames');

class WebhooksHandler {

    init(options) {
        this._options = options;
        stateManager.on('job-result', async (response) => {
            const webhook = new Webhook({
                webhookID: response.jobId,
                data: response.data.result
            });
            const pipeline = await stateManager.getExecution({ jobId: response.jobId });
            const url = pipeline.webhook.resultHook.url;
            this._request(url, this._options.webhook.resultHook, webhook, 'result');
        })

        stateManager.on('job-status', async (response) => {
            const webhook = new Webhook({
                webhookID: response.jobId,
                data: response.data.status
            });
            const pipeline = await stateManager.getExecution({ jobId: response.jobId });
            const url = pipeline.webhook.progressHook.url;
            this._request(url, this._options.webhook.progressHook, webhook, 'status');
        })
    }

    _request(url, settings, body, type) {
        log.info(`trying to call ${type} webhook ${url}`, { component: components.WEBHOOK_HANDLER });
        request({
            method: 'POST',
            uri: url,
            body: body,
            json: true,
            maxAttempts: settings.maxAttempts,
            retryDelay: settings.retryDelay,
            retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        }).then((response) => {
            log.info(`webhook ${type} completed with status ${response.statusCode} ${response.statusMessage}, attempts: ${response.attempts}`, { component: components.WEBHOOK_HANDLER });
        }).catch((error) => {
            log.error(`webhook ${type} failed ${error.message}`, { component: components.WEBHOOK_HANDLER });
        });
    }
}

module.exports = new WebhooksHandler();