class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateOptimizer(optimizer, spec) {
        this._validator.validate(this._validator.definitions.optimizer, spec, true);
        this._validator.validate(this._validator.definitions.algorithm, optimizer, true);
    }
}

module.exports = ApiValidator;
