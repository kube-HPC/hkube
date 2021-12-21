const InvalidDataError = require('../errors/InvalidDataError');
class Preference {
    constructor(validator) {
        this._validator = validator;
    }

    validatePreferenceRequest(preferenceRequest) {
        this._validator.validate(
            this._validator.definitions.updatePreferredRequest,
            preferenceRequest
        );
        const { position, query } = preferenceRequest.addedJobs;
        if ((position === 'first' || position === 'last')) {
            if (query) {
                throw new InvalidDataError('No query is needed in case of position first or last');
            }
        }
        else {
            const numberOfFields = Object.keys(query).filter(key => query[key] !== undefined).length;
            if (numberOfFields > 1) {
                throw new InvalidDataError('Query must contain only one of jobId ,tag ,pipelineName');
            }
            const { tag, jobId, pipeline } = query;
            if (!(tag || pipeline || jobId)) {
                throw new InvalidDataError('Query must contain one of jobId ,tag ,pipelineName');
            }
        }
    }
}

module.exports = Preference;
