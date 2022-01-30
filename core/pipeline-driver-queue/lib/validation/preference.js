const queuePosition = require('@hkube/consts').queuePositions;
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
        if ((position === queuePosition.FIRST || position === queuePosition.LAST) && query) {
            throw new InvalidDataError('No query is needed in case of position first or last');
        }
        else if (position === queuePosition.BEFORE || position === queuePosition.AFTER) {
            if (!query) {
                throw new InvalidDataError('Must supply query in case of position before or after');
            }
            const numberOfFields = Object.keys(query).filter(key => query[key] !== undefined).length;
            if (numberOfFields > 1) {
                throw new InvalidDataError('Query must contain only one of jobId ,tag ,pipelineName');
            }
            if (numberOfFields === 0) {
                throw new InvalidDataError('Query must contain one of jobId ,tag ,pipeline');
            }
        }
    }
}

module.exports = Preference;
