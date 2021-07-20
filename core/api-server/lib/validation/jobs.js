class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateJobID(pipeline) {
        this._validator.validate(this._validator.definitions.jobIdObject, pipeline, false);
    }
}

module.exports = ApiValidator;
