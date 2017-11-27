const request = require('requestretry');
const stateManager = require('lib/state/state-manager');
const Webhook = require('./web-hook');
const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const components = require('common/consts/componentNames');

const levels = {
    silly: 0,
    debug: 1,
    info: 2,
    warning: 3,
    error: 4,
    critical: 5
};

class WebhooksHandler {

    init(options) {
        this._options = options;
        stateManager.on('job-result', async (response) => {
            const webhook = new Webhook({
                webhookID: response.jobId,
                data: response.data.result
            });
            const pipeline = await stateManager.getExecution({ jobId: response.jobId });
            this._request(pipeline.webhooks.resultHook.url, this._options.webhooks.resultHook, webhook, 'result');
        })

        stateManager.on('job-status', async (response) => {
            const webhook = new Webhook({
                webhookID: response.jobId,
                data: response.data.status
            });
            const pipeline = await stateManager.getExecution({ jobId: response.jobId });
            const pipelineLevel = levels[pipeline.options.progressVerbosityLevel];
            const progressLevel = levels[response.data.level];

            log.info(`got progress event with ${response.data.level} verbosity, client request was ${pipeline.options.progressVerbosityLevel} verbosity`, { component: components.WEBHOOK_HANDLER });

            if (progressLevel <= pipelineLevel) {
                this._request(pipeline.webhooks.progressHook.url, this._options.webhooks.progressHook, webhook, 'status');
            }
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