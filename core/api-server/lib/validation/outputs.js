class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateOutput(output) {
        this._validator.validate(this._validator.definitions.output, output, true);
    }
}

module.exports = ApiValidator;
