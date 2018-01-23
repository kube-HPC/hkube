const request = require('requestretry');
const stateManager = require('../state/state-manager');
const log = require('@hkube/logger').GetLogFromContainer();
const components = require('../../common/consts/componentNames');
const levels = require('../progress/progressLevels');
const States = require('./States');

class WebhooksHandler {
    init(options) {
        this._options = options;
        this._recovery();
        this._watch();
    }

    _watch() {
        stateManager.on('job-result', async (response) => {
            this._requestResults(response.jobId, response);
        });

        stateManager.on('job-status', async (response) => {
            this._requestStatus(response.jobId, response);
        });
    }

    async _recovery() {
        const jobResults = await stateManager.getCompletedJobs();
        jobResults.forEach(async (job) => {
            if ((!job.resultLog) || (job.resultLog && job.resultLog.pipelineStatus !== job.result.data.status)) {
                this._requestResults(job.jobId, job.result);
            }
            if ((!job.statusLog) || (job.statusLog && job.statusLog.pipelineStatus !== job.status.data.status)) {
                this._requestStatus(job.jobId, job.status);
            }
        });
    }

    async _requestStatus(jobId, payload) {
        const pipeline = await stateManager.getExecution({ jobId });
        if (pipeline.webhooks && pipeline.webhooks.progress) {
            const clientLevel = levels[pipeline.options.progressVerbosityLevel].level;
            const pipelineLevel = levels[payload.data.level].level;
            log.debug(`progress event with ${payload.data.level} verbosity, client requested ${pipeline.options.progressVerbosityLevel} verbosity`, { component: components.WEBHOOK_HANDLER });
            if (clientLevel <= pipelineLevel) {
                const result = await this._request(pipeline.webhooks.progress, payload, 'progress', payload.data.status);
                stateManager.setJobStatusLog({ jobId, data: result });
            }
        }
    }

    async _requestResults(jobId, payload) {
        const pipeline = await stateManager.getExecution({ jobId });
        if (pipeline.webhooks && pipeline.webhooks.result) {
            const result = await this._request(pipeline.webhooks.result, payload, 'result', payload.data.status);
            stateManager.setJobResultsLog({ jobId, data: result });
        }
    }

    _request(url, body, type, pipelineStatus) {
        return new Promise((resolve, reject) => {
            log.debug(`trying to call ${type} webhook ${url}`, { component: components.WEBHOOK_HANDLER });
            request({
                method: 'POST',
                uri: url,
                body,
                json: true,
                maxAttempts: this._options.webhooks.retryStrategy.maxAttempts,
                retryDelay: this._options.webhooks.retryStrategy.retryDelay,
                retryStrategy: request.RetryStrategies.HTTPOrNetworkError
            }).then((response) => {
                const data = {
                    url,
                    pipelineStatus,
                    responseStatus: response.statusCode >= 400 ? States.FAILED : States.SUCCEEDED,
                    httpResponse: { statusCode: response.statusCode, statusMessage: response.statusMessage }
                };
                log.debug(`webhook ${type} completed with status ${response.statusCode} ${response.statusMessage}, attempts: ${response.attempts}`, { component: components.WEBHOOK_HANDLER });
                return resolve(data);
            }).catch((error) => {
                const data = {
                    url,
                    pipelineStatus,
                    responseStatus: States.FAILED,
                    httpResponse: { statusCode: error.code, statusMessage: error.message }
                };
                log.error(`webhook ${type} failed ${error.message}`, { component: components.WEBHOOK_HANDLER });
                return resolve(data);
            });
        });
    }
}

module.exports = new WebhooksHandler();
