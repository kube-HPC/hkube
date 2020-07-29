class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateResultList(pipeline) {
        this._validator.validate(this._validator.definitionsInternal.list, pipeline, true);
    }

    validateListRange(options) {
        this._validator.validate(this._validator.definitionsInternal.listRange, options);
    }
}

module.exports = ApiValidator;
