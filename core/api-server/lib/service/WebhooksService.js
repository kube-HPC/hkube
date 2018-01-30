const stateManager = require('../state/state-manager');
const validator = require('../validation/api-validator');
const { ResourceNotFoundError, } = require('../errors/errors');

class WebhooksService {
    async getJobResultsLog(options) {
        validator.validateJobID(options);
        const status = await stateManager.getJobResultsLog({ jobId: options.jobId });
        if (!status) {
            throw new ResourceNotFoundError('webhookLog', options.jobId);
        }
        return status;
    }

    async getJobStatusLog(options) {
        validator.validateJobID(options);
        const status = await stateManager.getJobStatusLog({ jobId: options.jobId });
        if (!status) {
            throw new ResourceNotFoundError('webhookLog', options.jobId);
        }
        return status;
    }
}

module.exports = new WebhooksService();
