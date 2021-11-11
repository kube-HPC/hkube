class ApiValidator {
    constructor(validator) {
        this._validator = validator;
    }

    validateHyperparamsTuner(hyperparamsTuner, spec) {
        this._validator.validate(this._validator.definitions.hyperparamsTuner, spec, true);
        this._validator.validate(this._validator.definitions.algorithm, hyperparamsTuner, true);
    }
}

module.exports = ApiValidator;
