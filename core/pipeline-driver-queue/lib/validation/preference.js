const InvalidDataError = require('../errors/InvalidDataError');
class Preference {
    constructor(validator) {
        this._validator = validator;
    }

    validatePreferenceRequest(preferenceRequest) {
        this._validator.validate(
            this._validator.definitions.addToPreferredRequest,
            preferenceRequest
        );
        const { position, query } = preferenceRequest;
        if ((position === 'first' || position === 'last') && query) {
            throw new InvalidDataError('No query is needed in case of position first or last');
        }
        else {
            const { tag, jobId, pipelineName } = query;
            if ((tag && jobId) || (tag && pipelineName) || (pipelineName && jobId)) {
                throw new InvalidDataError('Query must contain only one of jobId ,tag ,pipelineName');
            }
            if (!(tag || pipelineName || jobId)) {
                throw new InvalidDataError('Query must contain one of jobId ,tag ,pipelineName');
            }
        }
    }
}

module.exports = Preference;
