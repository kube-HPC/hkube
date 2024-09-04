class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateLogin(options) {
        this._validator.validate(this._validator.definitions.loginRequest, options, false);
    }
}

module.exports = ApiValidator;
