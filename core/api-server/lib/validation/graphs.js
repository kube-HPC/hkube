class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateGraphQuery(options) {
        this._validator.validate(this._validator.definitionsInternal.graph, options, true);
    }
}

module.exports = ApiValidator;
