const request = require('requestretry');
const stateManager = require('../state/state-manager');
const storageFactory = require('../datastore/storage-factory');
const log = require('@hkube/logger').GetLogFromContainer();
const component = require('../../common/consts/componentNames').WEBHOOK_HANDLER;
const levels = require('../progress/progressLevels');
const { States, Types } = require('./States');
const { metrics, utils } = require('@hkube/metrics');
const { metricsNames } = require('../../common/consts/metricsNames');

class WebhooksHandler {
    init(options) {
        this._options = options;
        metrics.addTimeMeasure({
            name: metricsNames.pipelines_gross,
            labels: ['pipeline_name', 'status'],
            buckets: utils.arithmatcSequence(30, 0, 2)
                .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
        });
        this._recovery();
        this._watch();
    }

    _watch() {
        stateManager.on('job-result', (response) => {
            this._requestResults(response);
            this._deleteExecution({ jobId: response.jobId });
        });
        stateManager.on('job-status', (response) => {
            this._requestStatus(response);
        });
    }

    async _recovery() {
        const webhooks = await stateManager.getWebhooks({ order: 'mod', sort: 'desc' });
        webhooks.forEach(async (w) => {
            if (w.result && w.result.status === States.PENDING) {
                const results = await stateManager.getJobResultMetadata({ jobId: w.jobId });
                if (results) {
                    this._requestResults({ jobId: w.jobId, ...results });
                }
            }
        });
    }

    async _requestStatus(payload) {
        const { jobId } = payload;
        const pipeline = await stateManager.getExecution({ jobId });

        if (pipeline.webhooks && pipeline.webhooks.progress) {
            const clientLevel = levels[pipeline.options.progressVerbosityLevel].level;
            const pipelineLevel = levels[payload.level].level;
            log.debug(`progress event with ${payload.level} verbosity, client requested ${pipeline.options.progressVerbosityLevel}`, { component, jobId });
            if (clientLevel <= pipelineLevel) {
                const result = await this._request(pipeline.webhooks.progress, payload, Types.PROGRESS, payload.status, jobId);
                await stateManager.setWebhook({ jobId, type: Types.PROGRESS, data: result });
            }
        }
        if (stateManager.isCompletedState(payload.status)) {
            await stateManager.releaseJobStatusLock({ jobId });
        }
    }

    async _requestResults(payload) {
        const { jobId } = payload;
        const pipeline = await stateManager.getExecution({ jobId });

        const time = Date.now() - pipeline.startTime;
        metrics.get(metricsNames.pipelines_gross).retroactive({
            time,
            labelValues: {
                pipeline_name: pipeline.name,
                status: payload.status
            }
        });
        if (pipeline.webhooks && pipeline.webhooks.result) {
            const payloadData = await storageFactory.getResults(payload);
            const result = await this._request(pipeline.webhooks.result, payloadData, Types.RESULT, payload.status, jobId);
            await stateManager.setWebhook({ jobId, type: Types.RESULT, data: result });
        }
        await stateManager.releaseJobResultsLock({ jobId });
    }

    // let anyone time to use this execution before deleting it
    _deleteExecution(options) {
        setTimeout(() => {
            stateManager.deleteExecution(options);
        }, 3000);
    }

    _request(url, body, type, pipelineStatus, jobId) {
        return new Promise((resolve) => {
            log.debug(`trying to call ${type} webhook ${url} (${pipelineStatus})`, { component });
            const data = {
                url,
                pipelineStatus,
                status: States.COMPLETED
            };
            request({
                method: 'POST',
                uri: url,
                body,
                json: true,
                maxAttempts: this._options.webhooks.retryStrategy.maxAttempts,
                retryDelay: this._options.webhooks.retryStrategy.retryDelay,
                retryStrategy: request.RetryStrategies.HTTPOrNetworkError
            }).then((response) => {
                data.responseStatus = response.statusCode >= 400 ? States.FAILED : States.SUCCEED;
                data.httpResponse = { statusCode: response.statusCode, statusMessage: response.statusMessage };
                log.debug(`${type} webhook has been sent with status ${response.statusCode} ${response.statusMessage}, attempts: ${response.attempts}`, { component, jobId });
                return resolve(data);
            }).catch((error) => {
                data.responseStatus = States.FAILED;
                data.httpResponse = { statusCode: error.code, statusMessage: error.message };
                log.warning(`webhook ${type} failed ${error.message}`, { component, jobId });
                return resolve(data);
            });
        });
    }
}

module.exports = new WebhooksHandler();
