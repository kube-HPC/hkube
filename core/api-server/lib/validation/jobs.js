class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateName(pipeline) {
        this._validator.validate(this._validator.definitionsInternal.name, pipeline, false);
    }

    validateJobID(pipeline) {
        this._validator.validate(this._validator.definitions.jobIdObject, pipeline, false);
    }
}

module.exports = ApiValidator;
