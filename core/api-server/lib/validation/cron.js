class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateCronRequest(options) {
        this._validator.validate(this._validator.definitions.cronRequest, options, false);
    }
}

module.exports = ApiValidator;
