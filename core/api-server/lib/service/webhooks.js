const db = require('../db');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, } = require('../errors');

class WebhooksService {
    async getWebhooksResults(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const status = await db.webhooks.result.fetch({ jobId });
        if (!status) {
            throw new ResourceNotFoundError('webhook', jobId);
        }
        return status;
    }

    async getWebhooksStatus(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const status = await db.webhooks.status.fetch({ jobId });
        if (!status) {
            throw new ResourceNotFoundError('webhook', jobId);
        }
        return status;
    }

    async getWebhooks(options) {
        validator.jobs.validateJobID(options);
        const { jobId } = options;
        const result = await db.webhooks.result.fetch({ jobId });
        const progress = await db.webhooks.status.fetch({ jobId });
        if (!result && !progress) {
            throw new ResourceNotFoundError('webhook', jobId);
        }
        return { jobId, result, progress };
    }
}

module.exports = new WebhooksService();
