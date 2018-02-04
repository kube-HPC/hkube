const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, } = require('../errors/errors');

class WebhooksService {
    async getWebhooksResults(options) {
        validator.validateJobID(options);
        const status = await stateManager.getWebhooksResults({ jobId: options.jobId });
        if (!status) {
            throw new ResourceNotFoundError('webhookLog', options.jobId);
        }
        return status;
    }

    async getWebhooksStatus(options) {
        validator.validateJobID(options);
        const status = await stateManager.getWebhooksStatus({ jobId: options.jobId });
        if (!status) {
            throw new ResourceNotFoundError('webhookLog', options.jobId);
        }
        return status;
    }
}

module.exports = new WebhooksService();
