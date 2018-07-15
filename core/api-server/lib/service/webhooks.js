const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, } = require('../errors');
const { Types } = require('../webhook/States');

class WebhooksService {
    async getWebhooksResults(options) {
        validator.validateJobID(options);
        const status = await stateManager.getWebhook({ jobId: options.jobId, type: Types.RESULT });
        if (!status) {
            throw new ResourceNotFoundError('webhookLog', options.jobId);
        }
        return status;
    }

    async getWebhooksStatus(options) {
        validator.validateJobID(options);
        const status = await stateManager.getWebhook({ jobId: options.jobId, type: Types.PROGRESS });
        if (!status) {
            throw new ResourceNotFoundError('webhookLog', options.jobId);
        }
        return status;
    }
}

module.exports = new WebhooksService();
