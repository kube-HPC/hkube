class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateGraphQuery(options) {
        this._validator.validate(this._validator.definitions.graphQuery, options, true);
    }
}

module.exports = ApiValidator;
