class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateOptimizer(optimizer) {
        this._validator.validate(this._validator.definitions.optimizer, optimizer, true);
    }
}

module.exports = ApiValidator;
