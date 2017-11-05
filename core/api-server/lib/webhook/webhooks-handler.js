const request = require('requestretry');
const stateManager = require('lib/state/state-manager');
const Webhook = require('./web-hook');
const Logger = require('logger.rf');
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
            const pipeline = await stateManager.getPipeline({ name: response.data.name });
            const webhookUrl = pipeline.webhook.resultHook;
            log.info(`job result event. trying to call webhook ${webhookUrl}`, { component: components.WEBHOOK_HANDLER });
            this._request(webhookUrl, this._options.webhook.resultHook, webhook);
        })

        stateManager.on('job-status', async (response) => {
            const webhook = new Webhook({
                webhookID: response.jobId,
                data: response.data.status
            });
            const pipeline = await stateManager.getPipeline({ name: response.data.name });
            const webhookUrl = pipeline.webhook.progressHook;
            log.info(`job progress event. trying to call webhook ${webhookUrl}`, { component: components.WEBHOOK_HANDLER });
            this._request(webhookUrl, this._options.webhook.progressHook, webhook);
        })
    }

    _request(url, settings, body) {
        request({
            method: 'POST',
            uri: url,
            body: body,
            json: true,
            maxAttempts: settings.maxAttempts,
            retryDelay: settings.retryDelay,
            retryStrategy: request.RetryStrategies.HTTPOrNetworkError
        }).then((response) => {
            log.info(`webhook completed with status ${response.statusCode} ${response.statusMessage}, attempts: ${response.attempts}`, { component: components.WEBHOOK_HANDLER });
        }).catch((error) => {
            log.error(`webhook failed ${error.message}`, { component: components.WEBHOOK_HANDLER });
        });
    }
}

module.exports = new WebhooksHandler();