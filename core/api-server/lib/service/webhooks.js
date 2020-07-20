const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, } = require('../errors');
const { Types } = require('../webhook/States');

class WebhooksService {
    async getWebhooksResults(options) {
        validator.jobs.validateJobID(options);
        const status = await stateManager.webhooks.get({ jobId: options.jobId, type: Types.RESULT });
        if (!status) {
            throw new ResourceNotFoundError('webhook', options.jobId);
        }
        return status;
    }

    async getWebhooksStatus(options) {
        validator.jobs.validateJobID(options);
        const status = await stateManager.webhooks.get({ jobId: options.jobId, type: Types.PROGRESS });
        if (!status) {
            throw new ResourceNotFoundError('webhook', options.jobId);
        }
        return status;
    }

    async getWebhooks(options) {
        validator.jobs.validateJobID(options);
        const webhooks = await stateManager.webhooks.list({ jobId: options.jobId });
        if (webhooks.length === 0) {
            throw new ResourceNotFoundError('webhook', options.jobId);
        }
        return webhooks;
    }
}

module.exports = new WebhooksService();
