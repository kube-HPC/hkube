const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, } = require('../errors');

class WebhooksService {
    async getWebhooksResults(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const status = await stateManager.getResultWebhook({ jobId });
        if (!status) {
            throw new ResourceNotFoundError('webhook', jobId);
        }
        return status;
    }

    async getWebhooksStatus(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const status = await stateManager.getStatusWebhook({ jobId });
        if (!status) {
            throw new ResourceNotFoundError('webhook', jobId);
        }
        return status;
    }

    async getWebhooks(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const result = await stateManager.getResultWebhook({ jobId });
        const progress = await stateManager.getStatusWebhook({ jobId });
        if (!result && !progress) {
            throw new ResourceNotFoundError('webhook', jobId);
        }
        return { jobId, result, progress };
    }
}

module.exports = new WebhooksService();
