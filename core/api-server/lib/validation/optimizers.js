class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateOutput(optimizer) {
        this._validator.validate(this._validator.definitions.optimizer, optimizer, true);
    }
}

module.exports = ApiValidator;
